import * as React from 'react';
import styles from './GreenVilleClient.module.scss';
import type { IGreenVilleClientProps } from './IGreenVilleClientProps';
import EntityView from '../../../Components/Entity/EntityView';
import ClientView from '../../../Components/Clients/ClientView';
import type { EntitySelection } from '../../../Components/Clients/RightPanelTabs/EntitiesTab';

interface IGreenVilleClientState {
  selectedClientId: number | null;
  selectedClientTermGuid: string | null;
  activeEntity: EntitySelection | null;
  viewMode: 'clients' | 'entity';
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
      selectedClientTermGuid: null,
      activeEntity: null,
      viewMode: 'clients'
    };
  }

  private handleSelectClient = (id: number, termGuid: string): void => {
    this.setState({
      selectedClientId: id,
      selectedClientTermGuid: termGuid,
      activeEntity: null,
      viewMode: 'clients'
    });
  };

  private handleOpenEntity = (entity: EntitySelection): void => {
    this.setState({ activeEntity: entity, viewMode: 'entity' });
  };

  private handleEntityChange = (entity: EntitySelection): void => {
    this.setState({ activeEntity: entity });
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
    const { selectedClientId, selectedClientTermGuid, activeEntity, viewMode } = this.state;

    const showEntity = viewMode === 'entity';

    return (
      <div className={styles.root}>
        <div className={styles.topTabs}>
          <button
            type="button"
            className={`${styles.topTab} ${viewMode === 'clients' ? styles.topTabActive : ''}`}
            onClick={() => this.setState({ viewMode: 'clients' })}
          >
            Clients
          </button>
          <button
            type="button"
            className={`${styles.topTab} ${viewMode === 'entity' ? styles.topTabActive : ''}`}
            onClick={() => this.setState({ viewMode: 'entity' })}
          >
            Entity
          </button>
        </div>

        {showEntity ? (
          <EntityView
            webUrl={webUrl}
            initialEntity={activeEntity}
            onEntityChange={this.handleEntityChange}
          />
        ) : (
          <ClientView
            webUrl={webUrl}
            selectedClientId={selectedClientId}
            selectedClientTermGuid={selectedClientTermGuid}
            onSelectClient={this.handleSelectClient}
            onEntityOpen={this.handleOpenEntity}
          />
        )}
      </div>
    );
  }
}
