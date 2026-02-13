export type ColumnConfig = {
  /** Display label for the UI row. */
  label: string;
  /** Candidate list field internal names to probe in priority order. */
  keys: string[];
};

// Centralized map of columns shown in the client Summary tab.
// Update this list to add/remove/reorder columns for the list.
export const SUMMARY_COLUMNS: ColumnConfig[] = [
  { label: 'Title', keys: ['Title'] },
  { label: 'Client', keys: ['Client'] },
  { label: 'Federal Tax ID', keys: ['FederalTaxID', 'Federal Tax ID'] },
  { label: 'Birthday', keys: ['Birthday'] },
  { label: 'Anniversary', keys: ['Anniversary'] },
  { label: 'Related Client', keys: ['RelatedClient', 'Related Client'] },
  { label: 'Related Entity', keys: ['RelatedEntity', 'Related Entity'] },
  { label: 'Address', keys: ['Address'] },
  { label: 'Created', keys: ['Created'] },
  { label: 'Modified By', keys: ['Editor', 'Modified By'] },
  { label: 'Children', keys: ['Children'] },
  { label: 'Parent 2', keys: ['Parent 2', 'Parent2', 'Parent_x0020_2'] },
  { label: 'Parents', keys: ['Parents'] },
  { label: 'Siblings', keys: ['Siblings'] },
  { label: 'Spouse', keys: ['Spouse0', 'Spouse'] },
];
