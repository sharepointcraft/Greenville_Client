import * as React from 'react';
import styles from './SummaryTab.module.scss';

interface SummaryTabProps {
  webUrl: string;
  clientId: number;
}

const SummaryTab: React.FC<SummaryTabProps> = ({ webUrl, clientId }) => {
  const [item, setItem] = React.useState<any>(null);

  React.useEffect(() => {
    loadSummary();
  }, [clientId]);

  const loadSummary = async () => {
    const response = await fetch(
      `${webUrl}/_api/web/lists/getByTitle('Clients')/items(${clientId})?` +
        `$select=*,Children/Title,Parents/Title,Spouse0/Title&$expand=Children,Parents,Spouse0`,
      {
        headers: {
          Accept: 'application/json;odata=nometadata'
        }
      }
    );
    if (!response.ok) {
      throw new Error(`Failed to load client summary. Status: ${response.status}`);
    }
    const data = await response.json();

    setItem(data);
  };

  if (!item) return null;

  const renderLookup = (values?: any[]) =>
    values?.map(v => v.Title).join(', ') || '—';

  const renderTaxonomy = (field?: any) =>
    field?.Label || '—';

  return (
    <div className={styles.detailCard}>
      <div className={styles.detailRow}>
        <div className={styles.detailLabel}>Client Name</div>
        <div className={styles.detailValue}>{item.Title}</div>

        <div className={styles.detailLabel}>Aliases</div>
        <div className={styles.detailValue}>{item.EntityAliases}</div>
      </div>

      <div className={styles.detailRow}>
        <div className={styles.detailLabel}>Address</div>
        <div className={styles.detailValue}>{item.Address}</div>

        <div className={styles.detailLabel}>Marital Status</div>
        <div className={styles.detailValue}>{item.MaritalStatus}</div>
      </div>

      <div className={styles.detailRow}>
        <div className={styles.detailLabel}>Birthday</div>
        <div className={styles.detailValue}>{item.Birthday}</div>

        <div className={styles.detailLabel}>Anniversary</div>
        <div className={styles.detailValue}>{item.Anniversary}</div>
      </div>

      <div className={styles.detailRow}>
        <div className={styles.detailLabel}>Children</div>
        <div className={styles.detailValue}>
          {renderLookup(item.Children)}
        </div>

        <div className={styles.detailLabel}>Related Client</div>
        <div className={styles.detailValue}>
          {renderTaxonomy(item.RelatedClient)}
        </div>
      </div>
    </div>
  );
};

export default SummaryTab;
