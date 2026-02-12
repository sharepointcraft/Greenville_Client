import * as React from 'react';
import { SPHttpClient } from '@microsoft/sp-http';
import styles from './RightPanel.module.scss';
import Summary from './Tabs/Summary';
import Documents from './Tabs/Documents';
import Tasks from './Tabs/Tasks';
import Entities from './Tabs/Entities';

const tabs = ['Summary', 'Documents', 'Tasks', 'Entities'] as const;

interface RightPanelProps {
  name?: string;
  spHttpClient: SPHttpClient;
  siteUrl: string;
  listTitle?: string;
}

type TabKey = typeof tabs[number];

const RightPanel: React.FC<RightPanelProps> = ({
  name,
  spHttpClient,
  siteUrl,
  listTitle = 'Clients',
}) => {
  const [activeTab, setActiveTab] = React.useState<TabKey>('Summary');
  const [clientItem, setClientItem] = React.useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const fetchClient = async (): Promise<void> => {
      if (!name) {
        setClientItem(null);
        return;
      }

      setLoading(true);
      setError(null);

      const safeName = name.replace(/'/g, "''");
      const safeListTitle = listTitle.replace(/'/g, "''");
      const url = `${siteUrl}/_api/web/lists/getbytitle('${safeListTitle}')/items?$select=*,FieldValuesAsText/*&$expand=FieldValuesAsText&$filter=Title eq '${safeName}'&$top=1`;

      try {
        const response = await spHttpClient.get(url, SPHttpClient.configurations.v1);
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const data = await response.json();
        const item = data?.value?.[0] ?? null;
        setClientItem(item);
        // eslint-disable-next-line no-console
        console.debug('Client fetch result', { url, item });
      } catch (err) {
        setError((err as Error).message);
        setClientItem(null);
      } finally {
        setLoading(false);
      }
    };

    fetchClient();
  }, [name, listTitle, siteUrl, spHttpClient]);

  const renderContent = () => {
    switch (activeTab) {
      case 'Summary':
        return (
          <Summary
            title={name}
            item={clientItem}
            loading={loading}
            error={error}
          />
        );
      case 'Documents':
        return <Documents />;
      case 'Tasks':
        return <Tasks />;
      case 'Entities':
        return <Entities />;
      default:
        return null;
    }
  };

  return (
    <div className={styles.rightPanel}>
      <h2 className={styles.personTitle}>{name || 'Client'}</h2>

      <div className={styles.tabs}>
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            className={`${styles.tab} ${activeTab === tab ? styles.activeTab : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className={styles.tabContent}>
        {renderContent()}
      </div>
    </div>
  );
};

export default RightPanel;
