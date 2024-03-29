import decorateRange, { createRange } from './range.js';
import formatFns from '../formatting.js';
import decorateTooltips from './tooltip.js';
import decorateLayout from './layout.js';
import decorateFieldsets from './fieldsets.js';
import decorateValidations from './validations.js';

function getSelector(fieldName) {
  let selector = fieldName;
  if (!fieldName.startsWith('.')) {
    selector = `.form-${fieldName}`;
  }
  return selector;
}

function decorateTermField(input) {
  const values = Array(6).fill(1).map((x, i) => formatFns.year(i + 1));
  if (input) {
    const clonedInput = input.cloneNode();
    clonedInput.type = 'hidden';
    input.min = 0;
    input.max = 6;
    input.step = 1;
    input.name += '-proxy';
    const rangeDiv = createRange(input, ['6 Months'].concat(values));
    rangeDiv.querySelector('input').addEventListener('input', (e) => {
      if (e.target.value === '0') clonedInput.value = 0.5;
      else clonedInput.value = e.target.value;
      const event = new Event('input', {
        bubbles: true,
        cancelable: true,
      });
      clonedInput.dispatchEvent(event);
    });
    rangeDiv.append(clonedInput);
    input.replaceWith(rangeDiv);
  }
}

const groups = {
  Input: ['totalLoanAmount', 'term', 'insuranceOptionFieldSet'].map(getSelector).join(','),
  Output: ['.form-output-wrapper', 'exploreRate', 'rate'].map(getSelector).join(','),
  buttons: '.form-button-wrapper',
};

const fieldsets = {
  insuranceOptionFieldSet: ['insuranceOption'].map(getSelector),
};

export default async function decorateRepaymentsCalculator(form) {
  /** add custom tooltips */
  decorateTooltips(form);

  form.querySelectorAll('.form-range-wrapper').forEach((block) => {
    decorateRange(block);
  });

  const termField = form.querySelector('.form-term input');
  decorateTermField(termField);

  decorateFieldsets(fieldsets, form);

  decorateLayout(form, groups);

  decorateValidations(form);
}
