export const TENANT_CONFIG = {
  sites: {
    prodHome: 'https://realitycraftprivatelimited.sharepoint.com/sites/Prod-Home',
    docCenter: 'https://realitycraftprivatelimited.sharepoint.com/sites/Prod-docCenter'
  },
  termStore: {
    groupId: 'cadcb7a6-fcde-4b81-a893-6071c3dd2cbb',
    sets: {
      clients: 'e15c7ba0-e449-437f-bb70-b35bc582edda',
      entities: '63f8136b-40cf-4d43-890a-73d4959c5a68',
      banks: 'e15c7ba0-e449-437f-bb70-b35bc582edda'
    }
  },
  lists: {
    clients: {
      title: 'Clients',
      listId: 'D055FA58-F79D-496A-A914-35E21B3675A9',
      rootFolder: '/sites/Prod-Home/Lists/Clients',
      allItemsUrl:
        'https://realitycraftprivatelimited.sharepoint.com/sites/Prod-Home/Lists/Clients/AllItems.aspx',
      contentTypeId:
        '0x0100C441AE8AC3A035499BD4A40EF481581600FD2764DABCAC504483BC664D29A7796D',
      newItemFormUrl:
        'https://realitycraftprivatelimited.sharepoint.com/sites/Prod-Home/_layouts/15/listform.aspx?PageType=8&ListId=%7BD055FA58-F79D-496A-A914-35E21B3675A9%7D&RootFolder=%2Fsites%2FProd-Home%2FLists%2FClients&Source=https%3A%2F%2Frealitycraftprivatelimited.sharepoint.com%2Fsites%2FProd-Home%2FLists%2FClients%2FAllItems.aspx&ContentTypeId=0x0100C441AE8AC3A035499BD4A40EF481581600FD2764DABCAC504483BC664D29A7796D',
      columns: {
        client: 'Client',
        relatedClient: 'RelatedClient',
        relatedEntity: 'RelatedEntity',
        children: 'Children',
        siblings: 'Siblings',
        parents: 'Parents'
      },
      queries: {
        leftPanelSelect: 'Id,Client',
        summarySelect:
          '*,Children/Id,Children/Title,Siblings/Id,Siblings/Title,Parents/Id,Parents/Title',
        summaryExpand: 'Children,Siblings,Parents',
        relatedClientSelect: 'RelatedClient'
      }
    },
    entities: {
      title: 'Entities',
      listId: '5B64CCEF-5176-4D1E-AFD2-BF67366BEA81',
      rootFolder: '/sites/Prod-Home/Lists/Entities',
      allItemsUrl:
        'https://realitycraftprivatelimited.sharepoint.com/sites/Prod-Home/Lists/Entities/AllItems.aspx',
      contentTypeId:
        '0x010005A065D7CC77D146A540E9E94E26F332009595D5DD684D9F47BDF0DE601379CD13',
      newItemFormUrl:
        'https://realitycraftprivatelimited.sharepoint.com/sites/Prod-Home/_layouts/15/listform.aspx?PageType=8&ListId=%7B5B64CCEF-5176-4D1E-AFD2-BF67366BEA81%7D&RootFolder=%2Fsites%2FProd-Home%2FLists%2FEntities&Source=https%3A%2F%2Frealitycraftprivatelimited.sharepoint.com%2Fsites%2FProd-Home%2FLists%2FEntities%2FAllItems.aspx&ContentTypeId=0x010005A065D7CC77D146A540E9E94E26F332009595D5DD684D9F47BDF0DE601379CD13',
      columns: {
        entity: 'Entity',
        relatedClient: 'RelatedClient',
        members: 'Members',
        manager: 'Manager',
        setter: 'Setter',
        beneficiary: 'Beneficiary',
        trustee: 'Trustee',
        bank: 'Bank'
      },
      queries: {
        listSelect: 'Id,Entity,RelatedClient',
        summarySelect:
          '*,Members/Title,Manager/Title,Setter/Title,Beneficiary/Title,Trustee/Title',
        summaryExpand: 'Members,Manager,Setter,Beneficiary,Trustee'
      }
    },
    tasks: {
      title: 'Tasks',
      listId: '6CD2A192-B82C-4304-A936-F400D0E66FEC',
      rootFolder: '/sites/Prod-Home/Lists/Tasks',
      allItemsUrl:
        'https://realitycraftprivatelimited.sharepoint.com/sites/Prod-Home/Lists/Tasks/AllItems.aspx',
      contentTypeId:
        '0x0100A2DB78381F4D3541900EBE1DE131DD3E0064E6958DA895BF44AC2862F2A62CFE11',
      newItemFormUrl:
        'https://realitycraftprivatelimited.sharepoint.com/sites/Prod-Home/_layouts/15/listform.aspx?PageType=8&ListId=%7B6CD2A192-B82C-4304-A936-F400D0E66FEC%7D&RootFolder=%2Fsites%2FProd-Home%2FLists%2FTasks&Source=https%3A%2F%2Frealitycraftprivatelimited.sharepoint.com%2Fsites%2FProd-Home%2FLists%2FTasks%2FAllItems.aspx&ContentTypeId=0x0100A2DB78381F4D3541900EBE1DE131DD3E0064E6958DA895BF44AC2862F2A62CFE11',
      columns: {
        title: 'Title',
        status: 'Status',
        priority: 'Priority',
        dueDate: 'DueDate1',
        relatedClient: 'RelatedClient',
        relatedEntity: 'RelatedEntity',
        assignedTo: 'AssignedTo1'
      },
      queries: {
        listSelect:
          'Id,Title,Status,Priority,DueDate1,RelatedClient,RelatedEntity,AssignedTo1/Title,AssignedTo1/EMail',
        listExpand: 'AssignedTo1'
      }
    }
  },
  libraries: {
    documentCenterPath: 'https://realitycraftprivatelimited.sharepoint.com/sites/Prod-docCenter/*',
    entityActivityFilters: [
      'All Documents',
      'Account Administration',
      'Letters of Direction (LOD)',
      'Trusts and Amendments',
      'Formation Documents',
      'Executed Legal Documents',
      'Correspondence',
      'Contracts',
      'Confidentiality Agreements',
      'Annual Meetings and Resolutions'
    ]
  },
  search: {
    contentClassDocumentLibrary: 'STS_ListItem_DocumentLibrary',
    rowLimitDefault: 500,
    rowLimitExpanded: 1000,
    managedProperties: {
      relatedClientTaxId: 'RelatedClientOWSTAXID',
      relatedClient: 'RelatedClient',
      relatedEntityTaxId: 'RelatedEntityOWSTAXID',
      relatedEntityTaxIdFallback: 'owstaxIdRelatedEntity',
      relatedEntity: 'RelatedEntity'
    },
    selectProperties: {
      documents:
        'Title,Path,LastModifiedTime,ParentLink,SiteTitle,FileType,Author,Editor,ModifiedBy,RelatedEntity,RelatedEntityOWSTAXID,owstaxIdRelatedEntity',
      documentsWithRelatedClient:
        'Title,Path,LastModifiedTime,ParentLink,SiteTitle,RelatedClientOWSTAXID,RelatedEntity,RelatedEntityOWSTAXID,owstaxIdRelatedEntity,Author,Editor,ModifiedBy'
    }
  },
  ui: {
    tabs: {
      top: ['Clients', 'Entity'],
      clientPanel: ['Summary', 'Documents', 'Tasks', 'Entities'],
      entityPanel: ['Summary', 'Documents', 'Tasks']
    },
    documents: {
      clientStatusFilters: [
        'All Documents',
        'Draft',
        'Approval',
        'Signature',
        'Hold',
        'Final',
        'Identification'
      ]
    },
    tasks: {
      priorityFilters: ['ALL', 'HIGH', 'NORMAL', 'LOW', 'ON HOLD'],
      priorityFilterButtons: [
        { value: 'ALL', label: 'All Tasks' },
        { value: 'HIGH', label: 'High' },
        { value: 'NORMAL', label: 'Normal' },
        { value: 'LOW', label: 'Low' },
        { value: 'ON HOLD', label: 'On Hold' }
      ]
    }
  },
  queryLimits: {
    listTop: 5000
  },
  patterns: {
    guid: /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g,
    guidExact: /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
  }
} as const;

export const buildListItemsApiUrl = (webUrl: string, listTitle: string): string =>
  `${webUrl}/_api/web/lists/getByTitle('${listTitle}')/items`;

export const buildTermSetTermsApiUrl = (webUrl: string, termSetId: string): string =>
  `${webUrl}/_api/v2.1/termstore/groups('${TENANT_CONFIG.termStore.groupId}')/sets('${termSetId}')/terms`;

export type PriorityFilter = (typeof TENANT_CONFIG.ui.tasks.priorityFilters)[number];
export type ClientPanelTab = (typeof TENANT_CONFIG.ui.tabs.clientPanel)[number];
export type EntityPanelTab = (typeof TENANT_CONFIG.ui.tabs.entityPanel)[number];
export type TopLevelTab = (typeof TENANT_CONFIG.ui.tabs.top)[number];
