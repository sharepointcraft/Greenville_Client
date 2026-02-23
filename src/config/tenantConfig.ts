const isGreenville = typeof window !== 'undefined' && window.location.hostname.includes('greenvilleptrs');

const REALITY_CRAFT = {
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
          'Id,Title,Status,Priority,DueDate1,RelatedClient,RelatedEntity,AssignedTo1/Title',
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

const GREENVILLE = {
  ...REALITY_CRAFT,
  sites: {
    prodHome: 'https://greenvilleptrs.sharepoint.com/sites/Prod-Home',
    docCenter: 'https://greenvilleptrs.sharepoint.com/sites/Prod-DocCenter'
  },
  termStore: {
    groupId: '35fa5400-bc14-40e7-97f0-71b8ab5d5409',
    sets: {
      clients: 'c303ee9c-f01a-40d9-8ef8-18778e0ecc13',
      entities: '29b96c62-c253-46e1-8d72-41b0d2ab86ec',
      banks: '6be8631f-bec1-46ba-b4cf-2e3704aeafbb'
    }
  },
  lists: {
    ...REALITY_CRAFT.lists,
    clients: {
      ...REALITY_CRAFT.lists.clients,
      allItemsUrl: 'https://greenvilleptrs.sharepoint.com/sites/Prod-Home/Lists/Clients/AllItems.aspx',
      newItemFormUrl: 'https://greenvilleptrs.sharepoint.com/sites/Prod-Home/_layouts/15/listform.aspx?PageType=8&ListId=%7BD055FA58-F79D-496A-A914-35E21B3675A9%7D&RootFolder=%2Fsites%2FProd-Home%2FLists%2FClients&Source=https%3A%2F%2Fgreenvilleptrs.sharepoint.com%2Fsites%2FProd-Home%2FLists%2FClients%2FAllItems.aspx&ContentTypeId=0x0100C441AE8AC3A035499BD4A40EF481581600FD2764DABCAC504483BC664D29A7796D'
    },
    entities: {
      ...REALITY_CRAFT.lists.entities,
      allItemsUrl: 'https://greenvilleptrs.sharepoint.com/sites/Prod-Home/Lists/Entities/AllItems.aspx',
      newItemFormUrl: 'https://greenvilleptrs.sharepoint.com/sites/Prod-Home/_layouts/15/listform.aspx?PageType=8&ListId=%7B5B64CCEF-5176-4D1E-AFD2-BF67366BEA81%7D&RootFolder=%2Fsites%2FProd-Home%2FLists%2FEntities&Source=https%3A%2F%2Fgreenvilleptrs.sharepoint.com%2Fsites%2FProd-Home%2FLists%2FEntities%2FAllItems.aspx&ContentTypeId=0x010005A065D7CC77D146A540E9E94E26F332009595D5DD684D9F47BDF0DE601379CD13'
    },
    tasks: {
      ...REALITY_CRAFT.lists.tasks,
      allItemsUrl: 'https://greenvilleptrs.sharepoint.com/sites/Prod-Home/Lists/Tasks/AllItems.aspx',
      newItemFormUrl: 'https://greenvilleptrs.sharepoint.com/sites/Prod-Home/_layouts/15/listform.aspx?PageType=8&ListId=%7B6CD2A192-B82C-4304-A936-F400D0E66FEC%7D&RootFolder=%2Fsites%2FProd-Home%2FLists%2FTasks&Source=https%3A%2F%2Fgreenvilleptrs.sharepoint.com%2Fsites%2FProd-Home%2FLists%2FTasks%2FAllItems.aspx&ContentTypeId=0x0100A2DB78381F4D3541900EBE1DE131DD3E0064E6958DA895BF44AC2862F2A62CFE11'
    }
  },
  libraries: {
    ...REALITY_CRAFT.libraries,
    documentCenterPath: 'https://greenvilleptrs.sharepoint.com/sites/Prod-DocCenter/*'
  }
} as const;

export const TENANT_CONFIG = isGreenville ? GREENVILLE : REALITY_CRAFT;

const resolveApiWebUrl = (webUrl: string): string => {
  const configured = TENANT_CONFIG.sites.prodHome.replace(/\/+$/, '');
  if (!webUrl) {
    return configured;
  }

  try {
    const current = new URL(webUrl);
    const target = new URL(configured);

    if (current.host.toLowerCase() !== target.host.toLowerCase()) {
      return configured;
    }
  } catch {
    return configured;
  }

  return configured;
};

export const buildListItemsApiUrl = (webUrl: string, listTitle: string): string =>
  `${resolveApiWebUrl(webUrl)}/_api/web/lists/getByTitle('${listTitle}')/items`;

export const buildTermSetTermsApiUrl = (webUrl: string, termSetId: string): string =>
  `${resolveApiWebUrl(webUrl)}/_api/v2.1/termstore/groups('${TENANT_CONFIG.termStore.groupId}')/sets('${termSetId}')/terms`;

const getODataNextLink = (payload: any): string | undefined => {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }

  return (
    payload['@odata.nextLink'] ||
    payload['@odata.nextlink'] ||
    payload['odata.nextLink'] ||
    payload['odata.nextlink']
  );
};

const extractTermLabelFromPayload = (payload: any): string | undefined => {
  if (!payload) return undefined;

  const getDefaultLabel = (term: any): string | undefined =>
    term?.labels?.find((l: any) => l?.isDefault)?.name || term?.labels?.[0]?.name;

  if (payload.id) {
    return getDefaultLabel(payload);
  }

  if (Array.isArray(payload.value) && payload.value.length) {
    return getDefaultLabel(payload.value[0]);
  }

  return undefined;
};

const fetchTermLabelByGuid = async (
  webUrl: string,
  termSetId: string,
  guid: string
): Promise<string | undefined> => {
  const apiWebUrl = resolveApiWebUrl(webUrl);
  const endpoints = [
    `${apiWebUrl}/_api/v2.1/termstore/groups('${TENANT_CONFIG.termStore.groupId}')/sets('${termSetId}')/terms('${guid}')`,
    `${apiWebUrl}/_api/v2.1/termstore/sets('${termSetId}')/terms('${guid}')`
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        headers: { Accept: 'application/json' }
      });

      if (!response.ok) {
        continue;
      }

      const payload = await response.json();
      const label = extractTermLabelFromPayload(payload);
      if (label) {
        return label;
      }
    } catch {
      // Try next endpoint.
    }
  }

  return undefined;
};

export const fetchTermLabelMap = async (
  webUrl: string,
  termSetId: string,
  targetGuids?: Set<string>
): Promise<Record<string, string>> => {
  const wanted = targetGuids
    ? new Set(Array.from(targetGuids).map(g => g.toLowerCase()))
    : undefined;

  const labels: Record<string, string> = {};
  const visitedUrls = new Set<string>();
  let url: string | undefined = buildTermSetTermsApiUrl(webUrl, termSetId);

  while (url && !visitedUrls.has(url)) {
    visitedUrls.add(url);

    const response = await fetch(url, {
      headers: { Accept: 'application/json' }
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Term set request failed (${response.status}): ${detail || response.statusText}`);
    }

    const payload = await response.json();
    const terms = Array.isArray(payload?.value) ? payload.value : [];

    terms.forEach((term: any) => {
      const id = String(term?.id || '').toLowerCase();
      if (!id) return;
      if (wanted && !wanted.has(id)) return;

      const label =
        term?.labels?.find((l: any) => l?.isDefault)?.name ||
        term?.labels?.[0]?.name;

      if (label) {
        labels[id] = String(label);
      }
    });

    if (wanted && Object.keys(labels).length >= wanted.size) {
      break;
    }

    url = getODataNextLink(payload);
  }

  if (wanted && wanted.size) {
    const unresolvedGuids = Array.from(wanted).filter(guid => !labels[guid]);
    if (unresolvedGuids.length) {
      await Promise.all(
        unresolvedGuids.map(async guid => {
          const label = await fetchTermLabelByGuid(webUrl, termSetId, guid);
          if (label) {
            labels[guid] = String(label);
          }
        })
      );
    }
  }

  return labels;
};

export type PriorityFilter = (typeof TENANT_CONFIG.ui.tasks.priorityFilters)[number];
export type ClientPanelTab = (typeof TENANT_CONFIG.ui.tabs.clientPanel)[number];
export type EntityPanelTab = (typeof TENANT_CONFIG.ui.tabs.entityPanel)[number];
export type TopLevelTab = (typeof TENANT_CONFIG.ui.tabs.top)[number];
