import * as React from 'react';
import styles from './DocumentsTab.module.scss';

const documents = [
  { name: 'Estate Plan Overview.pdf', category: 'Planning', updatedOn: '2026-02-02' },
  { name: 'Trust Agreement.docx', category: 'Legal', updatedOn: '2026-02-06' },
  { name: 'Tax Worksheet 2025.xlsx', category: 'Tax', updatedOn: '2026-01-28' },
];

const DocumentsTab: React.FC = () => (
  <div className={styles.container}>
    {documents.map((doc) => (
      <div className={styles.documentRow} key={doc.name}>
        <div className={styles.documentName}>{doc.name}</div>
        <div className={styles.documentMeta}>{doc.category}</div>
        <div className={styles.documentMeta}>{doc.updatedOn}</div>
      </div>
    ))}
  </div>
);

export default DocumentsTab;
