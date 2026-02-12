import * as React from 'react';
import styles from './GreenVilleClient.module.scss';
import type { IGreenVilleClientProps } from './IGreenVilleClientProps';
import LeftPanel from '../../../Components/LeftPanel';
import RightPanel from '../../../Components/RightPanel';

interface IGreenVilleClientState {
  selectedClientName: string;
}

export default class GreenVilleClient extends React.Component<IGreenVilleClientProps, IGreenVilleClientState> {
  public constructor(props: IGreenVilleClientProps) {
    super(props);
    this.state = {
      selectedClientName: 'Alex Tuzzolino',
    };
  }

  private handleSelectClient = (name: string): void => {
    this.setState({ selectedClientName: name });
  };

  public render(): React.ReactElement<IGreenVilleClientProps> {
    const {
    } = this.props;
    const { selectedClientName } = this.state;

    return (
      <div className={styles.layout}>
        <div className={`${styles.leftColumn} ${styles.panelWrapper}`}>
          <LeftPanel
            selectedName={selectedClientName}
            onSelect={this.handleSelectClient}
          />
        </div>
        <div className={`${styles.rightColumn} ${styles.panelWrapper}`}>
          <RightPanel name={selectedClientName} />
        </div>
      </div>
    );
  }
}
