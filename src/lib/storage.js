export const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;

export const getDeviceId = () => {
  try {
    let id = localStorage.getItem('aerosage_device');
    if (!id) {
      id = uid();
      localStorage.setItem('aerosage_device', id);
    }
    return id;
  } catch {
    return uid();
  }
};

export const loadFamily = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem('aerosage_family'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const saveFamily = (family) => {
  try {
    localStorage.setItem('aerosage_family', JSON.stringify(family));
  } catch {
    /* storage unavailable (private mode): keep in memory only */
  }
};
