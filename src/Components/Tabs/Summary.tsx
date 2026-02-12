import * as React from 'react';
import styles from '../RightPanel.module.scss';

export interface Person {
  name: string;
  alias: string;
  address: string;
  maritalStatus: string;
  generation: string;
  birthday: string;
  driversLicense: string;
  federalTaxId: string;
  anniversary: string;
}

interface SummaryProps {
  person: Person;
}

const Summary: React.FC<SummaryProps> = ({ person }) => {
  return (
    <div className={styles.detailCard}>
      <div className={styles.detailRow}>
        <div className={styles.detailLabel}>Client Name:</div>
        <div className={styles.detailValue}>{person.name}</div>
        <div className={styles.detailLabel}>Aliases:</div>
        <div className={styles.detailValue}>{person.alias}</div>
      </div>

      <div className={styles.detailRow}>
        <div className={styles.detailLabel}>Address:</div>
        <div className={styles.detailValue}>
          {person.address.split('\n').map((line, idx) => (
            <React.Fragment key={idx}>
              {line}
              <br />
            </React.Fragment>
          ))}
        </div>
        <div className={styles.detailLabel}>Marital Status:</div>
        <div className={styles.detailValue}>{person.maritalStatus}</div>
      </div>

      <div className={styles.detailRow}>
        <div className={styles.detailLabel}>Generation:</div>
        <div className={styles.detailValue}>{person.generation}</div>
        <div className={styles.detailLabel}>Birthday:</div>
        <div className={styles.detailValue}>{person.birthday}</div>
      </div>

      <div className={styles.detailRow}>
        <div className={styles.detailLabel}>Federal Tax ID:</div>
        <div className={styles.detailValue}>{person.federalTaxId}</div>
        <div className={styles.detailLabel}>Drivers License:</div>
        <div className={styles.detailValue}>{person.driversLicense}</div>
      </div>

      <div className={styles.detailRow}>
        <div className={styles.detailLabel}>Anniversary:</div>
        <div className={styles.detailValue}>{person.anniversary}</div>
        <div className={styles.detailSpacer} />
        <div className={styles.detailSpacer} />
      </div>
    </div>
  );
};

export default Summary;
