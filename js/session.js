const normalizePerfilLabel = (rawPerfil) => {
  const perfil = String(rawPerfil || localStorage.getItem('mercadinho_perfil') || 'FUNCIONARIO').trim().toUpperCase();

  const labels = {
    DONO: 'Dono',
    FUNCIONARIO: 'Funcionário'
  };

  return labels[perfil] || perfil.charAt(0).toUpperCase() + perfil.slice(1).toLowerCase();
};

const applySessionUserInfo = () => {
  const perfilLabel = normalizePerfilLabel(localStorage.getItem('mercadinho_perfil'));

  document.querySelectorAll('.profile-tag').forEach((element) => {
    element.textContent = perfilLabel;
  });
};

document.addEventListener('DOMContentLoaded', applySessionUserInfo);
