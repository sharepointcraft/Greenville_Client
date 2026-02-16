import * as React from 'react';
import { SPHttpClient } from '@microsoft/sp-http';
import styles from './LeftPanel.module.scss';

interface LeftPanelProps {
  webUrl: string;
  selectedClientId: number | null;
  onSelect: (id: number) => void;
}

interface ITerm {
  id: string;
  label: string;
}

interface IClientUsage {
  itemId: number;
  termGuid: string;
}

const TERM_GROUP_ID = 'cadcb7a6-fcde-4b81-a893-6071c3dd2cbb';
const TERM_SET_ID = 'e15c7ba0-e449-437f-bb70-b35bc582edda';

const LeftPanel: React.FC<LeftPanelProps> = ({ webUrl, selectedClientId, onSelect }) => {
  const [items, setItems] = React.useState<
    { id: number; label: string }[]
  >([]);

  React.useEffect(() => {
    loadClientsFromTerms();
  }, []);

  const loadClientsFromTerms = async () => {
    try {
      /** 1️⃣ Load Clients list items (used terms only) */
      const listResp = await fetch(
        `${webUrl}/_api/web/lists/getByTitle('Clients')/items` +
          `?$select=Id,Client`,
        {
          headers: { Accept: 'application/json;odata=nometadata' }
        }
      );

      const listData = await listResp.json();

      const usedTerms: IClientUsage[] = (listData.value || [])
        .map((item: any) => {
          const term = item.Client;
          if (!term?.TermGuid) return null;
          return {
            itemId: item.Id,
            termGuid: term.TermGuid
          };
        })
        .filter(Boolean);

      if (!usedTerms.length) {
        setItems([]);
        return;
      }

      /** 2️⃣ Load Term Store terms */
      const termResp = await fetch(
        `${webUrl}/_api/v2.1/termstore/groups('${TERM_GROUP_ID}')/sets('${TERM_SET_ID}')/terms`,
        {
          headers: { Accept: 'application/json' }
        }
      );

      const termData = await termResp.json();

      /** 3️⃣ Match terms used in list */
      const termMap = new Map<string, string>();
      termData.value.forEach((t: any) => {
        termMap.set(t.id.toLowerCase(), t.labels[0].name);
      });

      const finalItems = usedTerms
        .filter(u => termMap.has(u.termGuid.toLowerCase()))
        .map(u => ({
          id: u.itemId,
          label: termMap.get(u.termGuid.toLowerCase())!
        }))
        .sort((a, b) => a.label.localeCompare(b.label));

      setItems(finalItems);

      if (finalItems.length && selectedClientId === null) {
        onSelect(finalItems[0].id);
      }
    } catch (err) {
      console.error('LeftPanel load error:', err);
      setItems([]);
    }
  };

  return (
    <div className={styles.leftPanel}>
      <div className={styles.panelHeader}>
        <span className={styles.headerTitle}>Clients</span>
        <button className={styles.addButton} type="button">
          + Add New
        </button>
      </div>

      <div className={styles.clientList}>
        {items.map(client => (
          <button
            key={client.id}
            type="button"
            className={`${styles.clientItem} ${
              client.id === selectedClientId ? styles.active : ''
            }`}
            onClick={() => onSelect(client.id)}
          >
            {client.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default LeftPanel;
