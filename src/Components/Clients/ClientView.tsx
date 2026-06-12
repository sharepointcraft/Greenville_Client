import * as React from 'react';
import layoutStyles from '../../webparts/greenVilleClient/components/GreenVilleClient.module.scss';
import LeftPanel from './LeftPanel';
import RightPanel from './RightPanel';
import type { EntitySelection } from './RightPanelTabs/EntitiesTab';

interface ClientViewProps {
  webUrl: string;
  selectedClientId: number | null;
  selectedClientTermGuid: string | null;
  selectedClientDocCenterTermGuid: string | null;
  selectedClientName: string | null;
  onSelectClient: (id: number, termGuid: string, name: string, docCenterTermGuid?: string | null) => void;
  onEntityOpen: (entity: EntitySelection) => void;
}

const ClientView: React.FC<ClientViewProps> = ({
  webUrl,
  selectedClientId,
  selectedClientTermGuid,
  selectedClientDocCenterTermGuid,
  selectedClientName,
  onSelectClient,
  onEntityOpen
}) => (
  <div className={layoutStyles.layout}>
    <div className={`${layoutStyles.leftColumn} ${layoutStyles.panelWrapper}`}>
      <LeftPanel
        webUrl={webUrl}
        selectedClientId={selectedClientId}
        onSelect={onSelectClient}
      />
    </div>

    <div className={`${layoutStyles.rightColumn} ${layoutStyles.panelWrapper}`}>
      <RightPanel
        webUrl={webUrl}
        clientId={selectedClientId}
        clientTermGuid={selectedClientTermGuid}
        clientDocCenterTermGuid={selectedClientDocCenterTermGuid}
        clientName={selectedClientName}
        onEntityOpen={onEntityOpen}
      />
    </div>
  </div>
);

export default ClientView;
