import * as React from 'react';
import styles from './GreenVilleClient.module.scss';
import type { IGreenVilleClientProps } from './IGreenVilleClientProps';
import LeftPanel from '../../../Components/LeftPanel';
import RightPanel from '../../../Components/RightPanel';

interface IGreenVilleClientState {
  selectedClientId: number | null;
  selectedClientTermGuid: string | null;
}

export default class GreenVilleClient extends React.Component<
  IGreenVilleClientProps,
  IGreenVilleClientState
> {
  private observer: MutationObserver | null = null;

  public constructor(props: IGreenVilleClientProps) {
    super(props);
    this.state = {
      selectedClientId: null,
      selectedClientTermGuid: null
    };
  }

private handleSelectClient = (id: number, termGuid: string): void => {
  this.setState({
    selectedClientId: id,
    selectedClientTermGuid: termGuid
  });
};


  public componentDidMount(): void {
    // Hide SharePoint chrome controls
    this.hideArrows();
    
    // Hide on DOM changes
    this.observer = new MutationObserver(() => this.hideArrows());
    this.observer.observe(document.body, { childList: true, subtree: true });
  }

  public componentWillUnmount(): void {
    if (this.observer) {
      this.observer.disconnect();
    }
  }

  private hideArrows = (): void => {
    const arrows = document.querySelectorAll('button[title*="scroll"], .ms-ScrollablePane--scrollbar, [aria-label*="scroll"], button[style*="position: absolute"]');
    arrows.forEach(arrow => {
      (arrow as HTMLElement).style.display = 'none';
    });
  };

  public render(): React.ReactElement<IGreenVilleClientProps> {
    const { webUrl } = this.props;
    const { selectedClientId, selectedClientTermGuid } = this.state;

    return (
      <div className={styles.layout}>
        <div className={`${styles.leftColumn} ${styles.panelWrapper}`}>
          <LeftPanel
            webUrl={webUrl}
            selectedClientId={selectedClientId}
            onSelect={this.handleSelectClient}
          />
        </div>

        <div className={`${styles.rightColumn} ${styles.panelWrapper}`}>
          <RightPanel
            webUrl={webUrl}
            clientId={selectedClientId}
            clientTermGuid={selectedClientTermGuid}
          />
        </div>
      </div>
    );
  }
}
