import * as React from 'react';
import styles from './LeftPanel.module.scss';

type ClientType = 'person' | 'house';

const clients: { name: string; type: ClientType }[] = [
  { name: 'Alex Tuzzolino', type: 'person' },
  { name: 'Alex & Hanna Tuzzolina', type: 'person' },
];

interface LeftPanelProps {
  selectedName?: string;
  onSelect: (name: string) => void;
}

const LeftPanel: React.FC<LeftPanelProps> = ({ selectedName, onSelect }) => {
  return (
    <div className={styles.leftPanel}>
      <div className={styles.panelHeader}>
        <span className={styles.headerTitle}>Clients</span>
        <button className={styles.addButton} type="button">+ Add New</button>
      </div>
      <div className={styles.clientList} role="list">
        {clients.map((client, index) => {
          const isActive = client.name === selectedName || (index === 0 && !selectedName);
          return (
            <button
              key={`${client.name}-${index}`}
              type="button"
              className={`${styles.clientItem} ${isActive ? styles.active : ''}`}
              role="listitem"
              onClick={() => onSelect(client.name)}
            >
              <span className={styles.clientName}>{client.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default LeftPanel;
