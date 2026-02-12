import * as React from 'react';
import styles from './RightPanel.module.scss';
import Summary, { Person } from './Tabs/Summary';
import Documents from './Tabs/Documents';
import Tasks from './Tabs/Tasks';
import Entities from './Tabs/Entities';

const tabs = ['Summary', 'Documents', 'Tasks', 'Entities'] as const;

interface RightPanelProps {
  name?: string;
}

const basePerson: Person = {
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
    switch (activeTab) {
      case 'Summary':
        return <Summary person={person} />;
      case 'Documents':
        return <Documents />;
      case 'Tasks':
        return <Tasks />;
      case 'Entities':
        return <Entities />;
      default:
        return null;
    }
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
