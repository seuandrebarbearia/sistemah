document.getElementById('login-form').addEventListener('submit', async event => {
  event.preventDefault();
  const status = document.getElementById('login-status');
  const button = event.currentTarget.querySelector('button');
  button.disabled = true;
  try {
    const response = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ senha: document.getElementById('senha').value }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    document.getElementById('senha').value = '';
    location.replace('admin.html');
  } catch (error) { status.textContent = error.message || 'Não foi possível validar o acesso. Verifique se o servidor está disponível.'; }
  finally { button.disabled = false; }
});
