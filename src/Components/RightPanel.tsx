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
}

const RightPanel: React.FC<RightPanelProps> = ({ webUrl, clientId }) => {
  const [activeTab, setActiveTab] = React.useState<TabKey>('Summary');

  if (!clientId) {
    return <div>Select a client</div>;
  }

  const renderContent = () => {
    if (activeTab === 'Summary') {
      return <SummaryTab webUrl={webUrl} clientId={clientId} />;
    }
    if (activeTab === 'Documents') return <DocumentsTab />;
    if (activeTab === 'Tasks') return <TasksTab />;
    return <EntitiesTab />;
  };

  return (
    <div className={styles.rightPanel}>
      <div className={styles.tabs}>
        {tabs.map(tab => (
          <button
            key={tab}
            className={`${styles.tab} ${activeTab === tab ? styles.activeTab : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className={styles.tabContent}>{renderContent()}</div>
    </div>
  );
};

export default RightPanel;
