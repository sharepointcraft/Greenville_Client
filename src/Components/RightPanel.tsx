import * as React from 'react';
import { SPHttpClient } from '@microsoft/sp-http';
import styles from './RightPanel.module.scss';
import SummaryTab from './RightPanelTabs/SummaryTab';
import DocumentsTab from './RightPanelTabs/DocumentsTab';
import TasksTab from './RightPanelTabs/TasksTab';
import EntitiesTab from './RightPanelTabs/EntitiesTab';

const tabs = ['Summary', 'Documents', 'Tasks', 'Entities'] as const;
type TabKey = (typeof tabs)[number];

interface RightPanelProps {
  webUrl: string;
  clientId: number | null;
  clientTermGuid: string | null;
}

const RightPanel: React.FC<RightPanelProps> = ({ webUrl, clientId, clientTermGuid }) => {
  const [activeTab, setActiveTab] = React.useState<TabKey>('Summary');

  if (!clientId) {
    return (
      <div className={styles.rightPanel}>
        <div className={styles.emptyState}>
          Select a client to view details
        </div>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'Summary':
        return <SummaryTab webUrl={webUrl} clientId={clientId} />;

case 'Documents':
        return <DocumentsTab webUrl={webUrl} clientId={clientId} />;

      case 'Tasks':
        return clientTermGuid ? <TasksTab webUrl={webUrl} clientId={clientId!} clientTermGuid={clientTermGuid}/> : null;

      case 'Entities':
        return <EntitiesTab />;

      default:
        return null;
    }
  };

  return (
    <div className={styles.rightPanel}>
      {/* Tabs */}
      <div className={styles.tabs}>
        {tabs.map(tab => (
          <button
            key={tab}
            type="button"
            className={`${styles.tab} ${
              activeTab === tab ? styles.activeTab : ''
            }`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className={styles.tabContent}>
        {renderContent()}
      </div>
    </div>
  );
};

export default RightPanel;
