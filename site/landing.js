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

const promptDialog = document.querySelector('#agent-prompt');
const promptText = document.querySelector('#prompt-text');
const promptStatus = document.querySelector('#prompt-status');
const copyPrompt = document.querySelector('#copy-prompt');

document.querySelector('#open-agent-prompt').addEventListener('click', async () => {
  promptDialog.showModal();
  if (promptText.value) {
    promptStatus.textContent = '';
    return;
  }
  promptStatus.textContent = 'Cargando el prompt…';
  try {
    const response = await fetch('PROMPT.md');
    if (!response.ok) throw new Error('Prompt no disponible');
    promptText.value = await response.text();
    copyPrompt.disabled = false;
    promptStatus.textContent = '';
  } catch {
    promptStatus.textContent = 'No se pudo cargar el prompt. Puedes abrirlo en GitHub.';
  }
});

copyPrompt.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(promptText.value);
    promptStatus.textContent = 'Prompt copiado.';
  } catch {
    promptText.focus();
    promptText.select();
    promptStatus.textContent = 'Texto seleccionado. Usa el comando de copiar de tu dispositivo.';
  }
});
