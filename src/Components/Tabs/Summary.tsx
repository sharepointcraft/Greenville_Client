import * as React from 'react';
import styles from '../RightPanel.module.scss';
import { SUMMARY_COLUMNS } from '../../constants/columns';

interface SummaryProps {
  title?: string;
  item: Record<string, unknown> | null;
  loading: boolean;
  error: string | null;
}

const formatValue = (value: unknown): React.ReactNode => {
  if (value === null || value === undefined) return '—';
  if (Array.isArray(value)) return value.join(', ');
  if (value instanceof Date) return value.toLocaleString();
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const Summary: React.FC<SummaryProps> = ({ title, item, loading, error }) => {
  if (loading) {
    return <div className={styles.placeholder}>Loading client details…</div>;
  }

  if (error) {
    return <div className={styles.placeholder}>Unable to load client: {error}</div>;
  }

  if (!item) {
    return (
      <div className={styles.placeholder}>
        {title ? `No record found for "${title}".` : 'Select a client to view details.'}
      </div>
    );
  }

  const fieldValuesAsText = (item.FieldValuesAsText as Record<string, unknown>) || {};

  const pickValue = (keys: string[]): unknown => {
    for (const key of keys) {
      if (fieldValuesAsText[key] !== undefined) return fieldValuesAsText[key];
      if (item[key] !== undefined) return item[key];
    }
    return null;
  };

  return (
    <div className={styles.detailCard}>
      {SUMMARY_COLUMNS.map(({ label, keys }) => (
        <div key={label} className={styles.detailRow}>
          <div className={styles.detailLabel}>{label}:</div>
          <div className={styles.detailValue}>{formatValue(pickValue(keys))}</div>
          <div className={styles.detailSpacer} />
          <div className={styles.detailSpacer} />
        </div>
      ))}
    </div>
  );
};

export default Summary;
