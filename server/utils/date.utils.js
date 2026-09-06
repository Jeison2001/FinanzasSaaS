export const localToday = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

/**
 * Fecha de HOY en la zona horaria del usuario (IANA, p.ej. 'America/Bogota').
 * 'en-CA' formatea como YYYY-MM-DD directamente. Si la zona es inválida o
 * el entorno no la soporta, cae al hoy local del server.
 */
export const todayInTimeZone = (tz) => {
    try {
        return new Intl.DateTimeFormat('en-CA', {
            timeZone: tz,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(new Date());
    } catch {
        return localToday();
    }
};

export const fmtLocalDate = (dateObj) => {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

export const getNextDate = (dateStr, recurrence) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    if (recurrence === 'daily') {
        return fmtLocalDate(new Date(year, month - 1, day + 1));
    } else if (recurrence === 'weekly') {
        return fmtLocalDate(new Date(year, month - 1, day + 7));
    } else if (recurrence === 'monthly') {
        const srcMonth = month - 1;
        const targetMonth = (srcMonth + 1) % 12;
        const targetYear = srcMonth === 11 ? year + 1 : year;
        const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
        return fmtLocalDate(new Date(targetYear, targetMonth, Math.min(day, lastDay)));
    } else if (recurrence === 'yearly') {
        const targetYear = year + 1;
        const targetMonth = month - 1;
        const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
        return fmtLocalDate(new Date(targetYear, targetMonth, Math.min(day, lastDay)));
    }
    return dateStr;
};
