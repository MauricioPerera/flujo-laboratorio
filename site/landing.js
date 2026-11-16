const demo = document.querySelector('#demo');
const flowValue = document.querySelector('#flow-value');
const flowResult = document.querySelector('#flow-result');

function showRoute(input) {
  const humidity = Number(input.value);
  const shouldWater = humidity < 40;
  demo.dataset.route = shouldWater ? 'regar' : 'no-regar';
  flowValue.textContent = `${humidity} %`;
  flowResult.textContent = shouldWater ? 'Regar' : 'No regar';
}

for (const input of demo.querySelectorAll('input[name="humedad"]')) {
  input.addEventListener('change', () => showRoute(input));
  if (input.checked) showRoute(input);
}

const editorStart = document.querySelector('#editor-start');
for (const button of document.querySelectorAll('[data-open-editor]')) {
  button.addEventListener('click', () => editorStart.showModal());
}
