import * as React from 'react';
import styles from './RightPanel.module.scss';
import SummaryTab from './RightPanelTabs/SummaryTab';
import DocumentsTab from './RightPanelTabs/DocumentsTab';
import TasksTab from './RightPanelTabs/TasksTab';
import EntitiesTab, { EntitySelection } from './RightPanelTabs/EntitiesTab';
import { TENANT_CONFIG, type ClientPanelTab } from '../../config/tenantConfig';

const DEBUG_PREFIX = '[Greenville Debug]';

const tabs = TENANT_CONFIG.ui.tabs.clientPanel;
type TabKey = ClientPanelTab;

interface RightPanelProps {
  webUrl: string;
  clientId: number | null;
  clientTermGuid: string | null;
  clientName?: string | null; // NEW: Added clientName prop
  onEntityOpen?: (entity: EntitySelection) => void;
}

const RightPanel: React.FC<RightPanelProps> = ({ 
  webUrl, 
  clientId, 
  clientTermGuid, 
  clientName, // NEW: Destructured clientName
  onEntityOpen 
}) => {
  const [activeTab, setActiveTab] = React.useState<TabKey>(
    TENANT_CONFIG.ui.tabs.clientPanel[0]
  );

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
        return <SummaryTab webUrl={webUrl} clientId={clientId} clientName={clientName} />;

      case 'Documents':
        return <DocumentsTab webUrl={webUrl} clientId={clientId} clientName={clientName} />;

      case 'Tasks':
        return clientTermGuid ? (
          <TasksTab
            webUrl={webUrl}
            clientId={clientId!}
            clientTermGuid={clientTermGuid}
          />
        ) : null;

      case 'Entities':
        return clientTermGuid ? (
          <EntitiesTab
            webUrl={webUrl}
            clientTermGuid={clientTermGuid}
            onEntityClick={onEntityOpen}
          />
        ) : null;

      default:
        return null;
    }
  };

  return (
    <div className={styles.rightPanel}>
      
      {/* NEW: Persistent Header for the Client Name */}
      {clientName && (
        <div className={styles.clientHeader}>
          <h2>{clientName}</h2>
        </div>
      )}

      {/* Tabs */}
      <div className={styles.tabs}>
        {tabs.map(tab => (
          <button
            key={tab}
            type="button"
            className={`${styles.tab} ${
              activeTab === tab ? styles.activeTab : ''
            }`}
            onClick={() => {
              console.log(`${DEBUG_PREFIX} Client panel tab clicked`, {
                tab,
                clientId,
                clientTermGuid,
                clientName
              });
              setActiveTab(tab);
            }}
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
