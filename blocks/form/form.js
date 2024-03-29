import {
  readBlockConfig,
} from '../../scripts/scripts.js';

function stripTags(input, allowd) {
  const allowed = ((`${allowd || ''}`)
    .toLowerCase()
    .match(/<[a-z][a-z0-9]*>/g) || [])
    .join(''); // making sure the allowed arg is a string containing only tags in lowercase (<a><b><c>)
  const tags = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi;
  const comments = /<!--[\s\S]*?-->/gi;
  return input.replace(comments, '')
    .replace(tags, ($0, $1) => (allowed.indexOf(`<${$1.toLowerCase()}>`) > -1 ? $0 : ''));
}

export function sanitizeHTML(input) {
  return stripTags(input, '<a>');
}

const formatFns = await (async function imports() {
  try {
    const formatters = await import('./formatting.js');
    return formatters.default;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log('Formatting library not found. Formatting will not be supported');
  }
  return {};
}());

function constructPayload(form) {
  const payload = {};
  [...form.elements].forEach((fe) => {
    if (fe.type === 'checkbox') {
      if (fe.checked) payload[fe.id] = fe.value;
    } else if (fe.id) {
      payload[fe.id] = fe.value;
    }
  });
  return payload;
}

async function submitForm(form) {
  const payload = constructPayload(form);
  const resp = await fetch(form.dataset.action, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ data: payload }),
  });
  await resp.text();
  return payload;
}

async function handleSubmit(form, redirectTo) {
  if (form.getAttribute('data-submitting') !== 'true') {
    form.setAttribute('data-submitting', 'true');
    await submitForm(form);
    const redirectLocation = redirectTo || form.getAttribute('data-redirect');
    window.location.href = redirectLocation;
  }
}

function setPlaceholder(element, fd) {
  if (fd.Placeholder) {
    element.setAttribute('placeholder', fd.Placeholder);
  }
}

function setNumberConstraints(element, fd) {
  if (fd.Max) {
    element.max = fd.Max;
  }
  if (fd.Min) {
    element.min = fd.Min;
  }
  if (fd.Step) {
    element.step = fd.Step || 1;
  }
}
function createLabel(fd, tagName = 'label') {
  const label = document.createElement(tagName);
  if (tagName === 'label') {
    label.setAttribute('for', fd.Id);
  }
  label.className = 'field-label';
  label.innerHTML = sanitizeHTML(fd.Label) || '';
  if (fd.Tooltip) {
    label.title = fd.Tooltip;
  }
  return label;
}

function createLegend(fd) {
  return createLabel(fd, 'legend');
}

export function createHelpText(fd) {
  const div = document.createElement('div');
  div.className = 'field-description';
  div.setAttribute('aria-live', 'polite');
  div.innerText = fd.Description;
  div.id = `${fd.Id}-description`;
  return div;
}

function createFieldWrapper(fd, tagName = 'div') {
  const fieldWrapper = document.createElement(tagName);
  const nameStyle = fd.Name ? ` form-${fd.Name}` : '';
  const fieldId = `form-${fd.Type}-wrapper${nameStyle}`;
  fieldWrapper.className = fieldId;
  fieldWrapper.classList.add('field-wrapper');
  fieldWrapper.append(createLabel(fd));
  if (fd.Hidden?.toLowerCase() === 'true') {
    fieldWrapper.dataset.hidden = 'true';
  }
  return fieldWrapper;
}

function createButton(fd) {
  const wrapper = createFieldWrapper(fd);
  const button = document.createElement('button');
  button.textContent = fd.Label;
  button.type = fd.Type;
  button.classList.add('button');
  button.setAttribute('data-redirect', fd.Extra);
  button.id = fd.Id;
  button.name = fd.Name;
  wrapper.replaceChildren(button);
  return wrapper;
}

function createInput(fd) {
  const input = document.createElement('input');
  input.type = fd.Type;
  const displayFormat = fd['Display Format'];
  if (displayFormat) {
    input.dataset.displayFormat = displayFormat;
  }
  setPlaceholder(input, fd);
  setNumberConstraints(input, fd);
  return input;
}

const withFieldWrapper = (element) => (fd) => {
  const wrapper = createFieldWrapper(fd);
  wrapper.append(element(fd));
  return wrapper;
};

const createTextArea = withFieldWrapper((fd) => {
  const input = document.createElement('textarea');
  setPlaceholder(input, fd);
  return input;
});

const createSelect = withFieldWrapper((fd) => {
  const select = document.createElement('select');
  if (fd.Placeholder) {
    const ph = document.createElement('option');
    ph.textContent = fd.Placeholder;
    ph.setAttribute('selected', '');
    ph.setAttribute('disabled', '');
    select.append(ph);
  }
  fd.Options.split(',').forEach((o) => {
    const option = document.createElement('option');
    option.textContent = o.trim();
    option.value = o.trim();
    select.append(option);
  });
  return select;
});

function createRadio(fd) {
  const wrapper = createFieldWrapper(fd);
  const radio = createInput(fd);
  if (fd.Selected?.toLowerCase() === 'true') {
    radio.checked = true;
  }
  wrapper.insertAdjacentElement('afterbegin', radio);
  return wrapper;
}

const createOutput = withFieldWrapper((fd) => {
  const output = document.createElement('output');
  output.name = fd.Name;
  const displayFormat = fd['Display Format'];
  if (displayFormat) {
    output.dataset.displayFormat = displayFormat;
  }
  const formatFn = formatFns[displayFormat] || ((x) => x);
  output.innerText = formatFn(fd.Value);
  return output;
});

const currencySymbol = 'R';
function createCurrency(fd) {
  const wrapper = createFieldWrapper(fd);
  const widgetWrapper = document.createElement('div');
  widgetWrapper.className = 'currency-input-wrapper';
  const currencyEl = document.createElement('div');
  currencyEl.className = 'currency-symbol';
  currencyEl.innerText = currencySymbol; // todo :read from css
  widgetWrapper.append(currencyEl);
  widgetWrapper.append(createInput({
    ...fd,
    Type: 'number',
  }));
  wrapper.append(widgetWrapper);
  return wrapper;
}

function createHidden(fd) {
  const input = document.createElement('input');
  input.type = 'hidden';
  input.id = fd.Id;
  input.name = fd.Name;
  input.value = fd.Value;
  return input;
}

function createFieldset(fd) {
  const wrapper = createFieldWrapper(fd, 'fieldset');
  wrapper.name = fd.Name;
  wrapper.replaceChildren(createLegend(fd));
  return wrapper;
}

const getId = (function getId() {
  const ids = {};
  return (name) => {
    ids[name] = ids[name] || 0;
    const idSuffix = ids[name] ? `-${ids[name]}` : '';
    ids[name] += 1;
    return `${name}${idSuffix}`;
  };
}());

const fieldRenderers = {
  radio: createRadio,
  checkbox: createRadio,
  submit: createButton,
  'text-area': createTextArea,
  select: createSelect,
  button: createButton,
  output: createOutput,
  hidden: createHidden,
  currency: createCurrency,
  fieldset: createFieldset,
};

function renderField(fd) {
  const renderer = fieldRenderers[fd.Type];
  let field;
  if (typeof renderer === 'function') {
    field = renderer(fd);
  } else {
    field = createFieldWrapper(fd);
    field.append(createInput(fd));
  }
  if (fd.Description) {
    field.append(createHelpText(fd));
  }
  return field;
}

async function fetchData(url) {
  const resp = await fetch(url);
  if (resp.ok) {
    const json = await resp.json();
    return json.data.map((fd) => ({
      ...fd,
      Id: fd.Id || getId(fd.Name),
    }));
  }
  // eslint-disable-next-line no-console
  console.log(`unable to fetch form data from ${url}`);
  return [];
}

async function fetchForm(pathname) {
  // get the main form
  const jsonData = await fetchData(pathname);
  return jsonData;
}

async function createForm(formURL, id) {
  const { pathname } = new URL(formURL);
  const data = await fetchForm(pathname);
  const form = document.createElement('form');
  form.id = id;
  const fields = data
    .map((fd) => ({ fd, el: renderField(fd) }));
  fields.forEach(({ fd, el }) => {
    const input = el.querySelector('input,text-area,select');
    if (fd.Mandatory && fd.Mandatory.toLowerCase() === 'true') {
      input.setAttribute('required', 'required');
    }
    if (input) {
      input.id = fd.Id;
      input.name = fd.Name;
      input.value = fd.Value;
      if (fd.Description) {
        input.setAttribute('aria-describedby', `${fd.Id}-description`);
        input.dataset.description = fd.Description;
      }
    }
  });
  form.append(...fields.map(({ el }) => el));
  try {
    const formDecorator = await import('./decorators/index.js');
    formDecorator.default(form);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log('no custom decorator found. default renditions will be used.');
  }
  // eslint-disable-next-line prefer-destructuring
  form.dataset.action = pathname.split('.json')[0];
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    e.submitter.setAttribute('disabled', '');
    handleSubmit(form, e.submitter.getAttribute('data-redirect'));
  });
  return form;
}

export default async function decorate(block) {
  const form = block.querySelector('a[href$=".json"]');
  const config = readBlockConfig(block);
  const id = config?.id?.trim();
  if (form) {
    block.replaceChildren(await createForm(form.href, id));
  }
}
