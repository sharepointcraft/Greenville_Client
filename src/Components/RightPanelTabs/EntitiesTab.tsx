import * as React from 'react';
import styles from './EntitiesTab.module.scss';

const entities = [
  { name: 'Tuzzolino Family Trust', role: 'Trust', jurisdiction: 'Michigan' },
  { name: 'AT Holdings LLC', role: 'Business', jurisdiction: 'Delaware' },
  { name: 'Hanna Education Fund', role: 'Fund', jurisdiction: 'Michigan' },
];

const EntitiesTab: React.FC = () => (
  <div className={styles.container}>
    {entities.map((entity) => (
      <div className={styles.entityCard} key={entity.name}>
        <div className={styles.entityName}>{entity.name}</div>
        <div className={styles.entityRow}>
          <span className={styles.entityLabel}>Type:</span>
          <span className={styles.entityValue}>{entity.role}</span>
        </div>
        <div className={styles.entityRow}>
          <span className={styles.entityLabel}>Jurisdiction:</span>
          <span className={styles.entityValue}>{entity.jurisdiction}</span>
        </div>
      </div>
    ))}
  </div>
);

export default EntitiesTab;
