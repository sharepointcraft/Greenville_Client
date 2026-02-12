import * as React from 'react';
import styles from './RightPanel.module.scss';

const tabs = ['Summary', 'Documents', 'Tasks', 'Entities'] as const;

interface RightPanelProps {
  name?: string;
}

const basePerson = {
  name: 'Alex Tuzzolino',
  alias: 'Alex M Tuzzolino',
  address: '638 Manhattan Rd SE\nGrand Rapids, MI 49506',
  maritalStatus: 'Married',
  generation: 'G3',
  birthday: '06-26-1989',
  driversLicense: 'T 245 044 603 500',
  federalTaxId: '362-19-4241',
  anniversary: 'Jun-06-2015',
};

type TabKey = typeof tabs[number];

const RightPanel: React.FC<RightPanelProps> = ({ name }) => {
  const [activeTab, setActiveTab] = React.useState<TabKey>('Summary');
  const person = { ...basePerson, name: name || basePerson.name };

  const renderContent = () => {
    if (activeTab !== 'Summary') {
      return (
        <div className={styles.placeholder}>
          {`${activeTab} content goes here.`}
        </div>
      );
    }

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

  return (
    <div className={styles.rightPanel}>
      <h2 className={styles.personTitle}>{person.name}</h2>

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
