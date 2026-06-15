import * as React from 'react';
import styles from './GreenVilleClient.module.scss';
import type { IGreenVilleClientProps } from './IGreenVilleClientProps';
import EntityView from '../../../Components/Entity/EntityView';
import ClientView from '../../../Components/Clients/ClientView';
import type { EntitySelection } from '../../../Components/Clients/RightPanelTabs/EntitiesTab';
import { TENANT_CONFIG } from '../../../config/tenantConfig';
import { loadGreenvilleMetadataCache } from '../../../services/metadataCacheService';
import { getCachedDocCenterDocuments } from '../../../services/docCenterSearchService';

const DEBUG_PREFIX = '[Greenville Debug]';

interface IGreenVilleClientState {
  selectedClientId: number | null;
  selectedClientTermGuid: string | null;
  selectedClientDocCenterTermGuid: string | null;
  selectedClientName: string | null;
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
      selectedClientDocCenterTermGuid: null,
      selectedClientName: null,
      activeEntity: null,
      viewMode: 'clients'
    };
  }

  private handleSelectClient = (
    id: number,
    termGuid: string,
    name: string,
    docCenterTermGuid?: string | null
  ): void => {
    console.log(`${DEBUG_PREFIX} App selected client`, { id, termGuid, name, docCenterTermGuid });
    this.setState({
      selectedClientId: id,
      selectedClientTermGuid: termGuid,
      selectedClientDocCenterTermGuid: docCenterTermGuid || null,
      selectedClientName: name,
      activeEntity: null,
      viewMode: 'clients'
    });
  };

  private handleOpenEntity = (entity: EntitySelection): void => {
    console.log(`${DEBUG_PREFIX} App opened entity from client view`, entity);
    this.setState({ activeEntity: entity, viewMode: 'entity' });
  };

  private handleEntityChange = (entity: EntitySelection): void => {
    console.log(`${DEBUG_PREFIX} App selected entity`, entity);
    this.setState({ activeEntity: entity });
  };

  public componentDidMount(): void {
    console.log(`${DEBUG_PREFIX} App mounted`, { webUrl: this.props.webUrl });
    // Hide SharePoint chrome controls
    this.hideArrows();
    loadGreenvilleMetadataCache(this.props.webUrl).catch(error => {
      console.warn('Greenville metadata cache warmup failed', error);
    });
    getCachedDocCenterDocuments().catch(error => {
      console.warn('Greenville document cache warmup failed', error);
    });
    
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
    const {
      selectedClientId,
      selectedClientTermGuid,
      selectedClientDocCenterTermGuid,
      selectedClientName,
      activeEntity,
      viewMode
    } = this.state;

    const showEntity = viewMode === 'entity';
    const [clientsLabel, entityLabel] = TENANT_CONFIG.ui.tabs.top;

    return (
      <div className={styles.root}>
        <div className={styles.topTabs}>
          <button
            type="button"
            className={`${styles.topTab} ${viewMode === 'clients' ? styles.topTabActive : ''}`}
            onClick={() => {
              console.log(`${DEBUG_PREFIX} Top tab clicked`, { viewMode: 'clients' });
              this.setState({ viewMode: 'clients' });
            }}
          >
            {clientsLabel}
          </button>
          <button
            type="button"
            className={`${styles.topTab} ${viewMode === 'entity' ? styles.topTabActive : ''}`}
            onClick={() => {
              console.log(`${DEBUG_PREFIX} Top tab clicked`, { viewMode: 'entity' });
              this.setState({ viewMode: 'entity' });
            }}
          >
            {entityLabel}
          </button>
        </div>

        <div style={{ display: showEntity ? 'none' : 'contents' }}>
          <ClientView
            webUrl={webUrl}
            selectedClientId={selectedClientId}
            selectedClientTermGuid={selectedClientTermGuid}
            selectedClientDocCenterTermGuid={selectedClientDocCenterTermGuid}
            selectedClientName={selectedClientName}
            onSelectClient={this.handleSelectClient}
            onEntityOpen={this.handleOpenEntity}
          />
        </div>
        <div style={{ display: showEntity ? 'contents' : 'none' }}>
          <EntityView
            webUrl={webUrl}
            initialEntity={activeEntity}
            onEntityChange={this.handleEntityChange}
          />
        </div>
      </div>
    );
  }
}
