export const componentCatalog = {
  badge: {
    props: ['variant', 'size', 'text', 'label', 'tone', 'value'],
    slots: {},
    requiredSlots: []
  },
  button: {
    props: ['variant', 'size', 'shape', 'text', 'label'],
    slots: {},
    requiredSlots: []
  },
  card: {
    props: ['title', 'description', 'tone'],
    slots: {
      body: ['field', 'input', 'button', 'badge'],
      footer: ['button', 'badge']
    },
    requiredSlots: ['body']
  },
  field: {
    props: ['label', 'helper', 'error', 'for', 'required'],
    slots: {
      control: ['input']
    },
    requiredSlots: ['control']
  },
  input: {
    props: ['id', 'type', 'name', 'value', 'placeholder', 'autocomplete', 'state'],
    slots: {},
    requiredSlots: []
  }
};
