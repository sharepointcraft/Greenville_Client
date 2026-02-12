import * as React from 'react';
import { SPHttpClient } from '@microsoft/sp-http';
import styles from './LeftPanel.module.scss';

interface LeftPanelProps {
  selectedName?: string;
  onSelect: (name: string) => void;
  spHttpClient: SPHttpClient;
  siteUrl: string;
  listTitle?: string;
}

const LeftPanel: React.FC<LeftPanelProps> = ({
  selectedName,
  onSelect,
  spHttpClient,
  siteUrl,
  listTitle = 'Clients',
}) => {
  const [clients, setClients] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const fetchClients = async (): Promise<void> => {
      setLoading(true);
      setError(null);

      const safeListTitle = listTitle.replace(/'/g, "''");
      const url = `${siteUrl}/_api/web/lists/getbytitle('${safeListTitle}')/items?$select=Title&$orderby=Title asc&$top=200`;

      try {
        const response = await spHttpClient.get(url, SPHttpClient.configurations.v1);
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        const data = await response.json();
        const names: string[] = (data?.value ?? [])
          .map((item: { Title?: string }) => item.Title)
          .filter(Boolean);

        setClients(names);

        if (!selectedName && names.length > 0) {
          onSelect(names[0]);
        }
      } catch (err) {
        setError((err as Error).message);
        setClients([]);
      } finally {
        setLoading(false);
      }
    };

    fetchClients();
  }, [listTitle, onSelect, selectedName, siteUrl, spHttpClient]);

  return (
    <div className={styles.leftPanel}>
      <div className={styles.panelHeader}>
        <span className={styles.headerTitle}>Clients</span>
        <button className={styles.addButton} type="button">+ Add New</button>
      </div>

      {loading && <div className={styles.clientList}>Loading clients…</div>}
      {error && <div className={styles.clientList}>Error loading clients: {error}</div>}

      {!loading && !error && (
        <div className={styles.clientList} role="list">
          {clients.map((client, index) => {
            const isActive = client === selectedName || (!selectedName && index === 0);
            return (
              <button
                key={`${client}-${index}`}
                type="button"
                className={`${styles.clientItem} ${isActive ? styles.active : ''}`}
                role="listitem"
                onClick={() => onSelect(client)}
              >
                <span className={styles.clientName}>{client}</span>
              </button>
            );
          })}

          {clients.length === 0 && (
            <div className={styles.placeholder}>No clients found.</div>
          )}
        </div>
      )}
    </div>
  );
};

export default LeftPanel;
