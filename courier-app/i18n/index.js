
import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const LANG_KEY = 'appLanguage';
export const LANGUAGES = ['ru', 'en', 'lv'];
export const DEFAULT_LANG = 'ru';

const ru = {
    common: { error: 'Ошибка', cancel: 'Отмена', delete: 'Удалить', save: 'Сохранить', retry: 'Повторить', dash: '—' },
    tabs: { menu: 'МЕНЮ', all: 'ВСЕ', my: 'МОИ' },
    login: {
        title: 'Авторизация',
        subtitle: 'Войдите в аккаунт курьера, чтобы продолжить',
        loginLabel: 'Логин',
        passwordLabel: 'Пароль',
        loginPlaceholder: 'Email или телефон',
        passwordPlaceholder: 'Введите пароль',
        signIn: 'Войти',
        signingIn: 'Выполняется...',
        errEnterCredentials: 'Пожалуйста, введите логин и пароль',
        errNoToken: 'Сервер не вернул токен',
        errLogin: 'Ошибка входа',
        errNetwork: 'Ошибка сети',
        errTryLater: 'Попробуйте позже',
    },
    shift: {
        loading: 'Загрузка данных курьера...',
        courier: 'Курьер',
        wsOnline: '● Online',
        wsConnecting: '○ Подключение...',
        onShift: 'НА СМЕНЕ',
        offline: 'НЕ НА СМЕНЕ',
        manageTitle: 'Управление сменой',
        manageSubtitle: 'Включайте и выключайте рабочую смену, управляйте статусом и выходом из аккаунта.',
        start: 'Начать смену',
        stop: 'Остановить смену',
        logout: 'Выйти из аккаунта',
        idLabel: 'ID',
        fgTitle: 'Смена активна',
        fgBody: 'Идёт передача геолокации для заказов.',
        permFg: 'Нужны права на геолокацию',
        permBg: 'Нужны права на геолокацию в фоне',
        errStartFail: 'Не удалось запустить смену',
        errStopFail: 'Не удалось остановить смену',
        errLogoutFail: 'Не удалось выйти. Попробуйте ещё раз.',
        takeSuccessTitle: 'Успешно',
        takeSuccessBody: 'Заказ добавлен в ваши заказы',
        removeTitle: 'Удалить заказ?',
        removeBody: 'Заказ будет отказан и станет доступным для других курьеров.',
    },
    allOrders: {
        title: 'ЗАКАЗЫ',
        subtitle: 'Выберите точку выдачи',
        allOutlets: 'Все точки',
        allActive: 'Все активные точки выдачи',
        openList: 'Открыть список заказов точки',
        allPill: 'ВСЕ',
    },
    ordersList: {
        allOrders: 'Все заказы',
        activeSuffix: 'активные',
        loading: 'Загрузка заказов...',
        empty: 'Нет доступных заказов',
        emptyHint: 'Когда появятся новые заказы, они будут отображаться здесь',
        statusNew: 'Новый',
        statusReady: 'Готов',
        statusEnroute: 'В пути',
        statusCancelled: 'Отменён',
        captionDelivery: 'выдача',
        captionAccepted: 'принят',
        acceptedAt: 'принят {{time}}',
        captionCurrent: 'текущий заказ',
        justNow: 'только что',
        minAgo: '{{m}} мин',
        hourMin: '{{h}} ч {{m}} мин',
    },
    report: {
        title: 'Отчёт за день',
        loading: 'Загрузка отчёта…',
        error: 'Не удалось загрузить отчёт',
        empty: 'Сегодня ещё нет завершённых заказов',
        retry: 'Повторить',
        summary: 'Моя сводка за день',
        byCourier: 'По курьерам',
        cash: 'Касса (наличные)',
        card: 'Терминал (карта)',
        wire: 'Перевод',
        total: 'Итого',
        orders: 'Заказы',
        items: 'Позиции',
        courier: 'Курьер',
        unassigned: 'Без курьера',
    },
    orderDetails: {
        order: 'ЗАКАЗ',
        outlet: 'Точка',
        created: 'создан',
        deliver: 'доставить',
        call: 'Звонок',
        waze: 'Waze',
        take: 'ВЗЯТЬ',
        address: 'Адрес',
        intercom: 'Домофон / код',
        comment: 'Комментарий',
        items: 'Состав заказа',
        noItems: 'Позиции не найдены.',
        discountLine: 'скидка {{percent}}%',
        subtotal: 'Итого по заказу',
        discount: 'Скидка',
        total: 'Итого к оплате',
        loading: 'Загрузка заказа...',
        cash: 'Наличные',
        card: 'Карта',
        statusNew: 'Новый',
        statusReady: 'Готов',
        statusActive: 'В работе',
        statusCompleted: 'Завершён',
        statusCancelled: 'Отменён',
    },
    myOrders: {
        title: 'МОИ ЗАКАЗЫ',
        subtitle: 'Активные и завершённые заказы курьера',
        empty: 'Нет заказов',
        emptyHint: 'Нажимайте "ВЗЯТЬ" на странице заказов',
        inWork: 'В работе',
        completed: 'Завершено',
        done: 'Готово',
        enroute: 'В путь',
        enrouteActive: 'В пути',
        closeTitle: 'Закрыть заказ',
        closeBody: 'Вы уверены что хотите закрыть заказ №{{number}}?',
        yesDone: 'Да, готово',
    },
    settings: {
        title: 'Настройки',
        soundSection: 'Звук оповещений',
        soundLabel: 'Звук новых заказов',
        on: 'Включен',
        off: 'Отключен',
        langSection: 'Язык интерфейса',
        themeSection: 'Тема приложения',
        themeDark: 'Тёмная',
        themeLight: 'Светлая',
        autosaveNote: 'Все изменения сохраняются автоматически',
    },
    toast: {
        assignedTitle: 'Вам назначен заказ',
        open: 'Открыть',
    },
};

const en = {
    common: { error: 'Error', cancel: 'Cancel', delete: 'Delete', save: 'Save', retry: 'Retry', dash: '—' },
    tabs: { menu: 'MENU', all: 'ALL', my: 'MINE' },
    login: {
        title: 'Sign in',
        subtitle: 'Sign in to your courier account to continue',
        loginLabel: 'Login',
        passwordLabel: 'Password',
        loginPlaceholder: 'Email or phone',
        passwordPlaceholder: 'Enter password',
        signIn: 'Sign in',
        signingIn: 'Signing in...',
        errEnterCredentials: 'Please enter login and password',
        errNoToken: 'Server did not return a token',
        errLogin: 'Sign-in error',
        errNetwork: 'Network error',
        errTryLater: 'Try again later',
    },
    shift: {
        loading: 'Loading courier data...',
        courier: 'Courier',
        wsOnline: '● Online',
        wsConnecting: '○ Connecting...',
        onShift: 'ON SHIFT',
        offline: 'OFF SHIFT',
        manageTitle: 'Shift management',
        manageSubtitle: 'Turn your work shift on and off, manage status and sign-out.',
        start: 'Start shift',
        stop: 'Stop shift',
        logout: 'Sign out',
        idLabel: 'ID',
        fgTitle: 'Shift active',
        fgBody: 'Sharing location for orders.',
        permFg: 'Location permission is required',
        permBg: 'Background location permission is required',
        errStartFail: 'Failed to start shift',
        errStopFail: 'Failed to stop shift',
        errLogoutFail: 'Failed to sign out. Please try again.',
        takeSuccessTitle: 'Success',
        takeSuccessBody: 'Order added to your orders',
        removeTitle: 'Remove order?',
        removeBody: 'The order will be declined and become available to other couriers.',
    },
    allOrders: {
        title: 'ORDERS',
        subtitle: 'Select a pickup point',
        allOutlets: 'All points',
        allActive: 'All active pickup points',
        openList: "Open point's orders",
        allPill: 'ALL',
    },
    ordersList: {
        allOrders: 'All orders',
        activeSuffix: 'active',
        loading: 'Loading orders...',
        empty: 'No available orders',
        emptyHint: 'New orders will appear here when available',
        statusNew: 'New',
        statusReady: 'Ready',
        statusEnroute: 'En route',
        statusCancelled: 'Cancelled',
        captionDelivery: 'delivery',
        captionAccepted: 'accepted',
        acceptedAt: 'accepted {{time}}',
        captionCurrent: 'current order',
        justNow: 'just now',
        minAgo: '{{m}} min',
        hourMin: '{{h}}h {{m}}m',
    },
    report: {
        title: 'Daily report',
        loading: 'Loading report…',
        error: 'Failed to load report',
        empty: 'No completed orders today yet',
        retry: 'Retry',
        summary: 'My summary',
        byCourier: 'By courier',
        cash: 'Cash',
        card: 'Terminal (card)',
        wire: 'Wire',
        total: 'Total',
        orders: 'Orders',
        items: 'Items',
        courier: 'Courier',
        unassigned: 'Unassigned',
    },
    orderDetails: {
        order: 'ORDER',
        outlet: 'Point',
        created: 'created',
        deliver: 'deliver',
        call: 'Call',
        waze: 'Waze',
        take: 'TAKE',
        address: 'Address',
        intercom: 'Intercom / code',
        comment: 'Comment',
        items: 'Order items',
        noItems: 'No items found.',
        discountLine: 'discount {{percent}}%',
        subtotal: 'Order subtotal',
        discount: 'Discount',
        total: 'Total due',
        loading: 'Loading order...',
        cash: 'Cash',
        card: 'Card',
        statusNew: 'New',
        statusReady: 'Ready',
        statusActive: 'In progress',
        statusCompleted: 'Completed',
        statusCancelled: 'Cancelled',
    },
    myOrders: {
        title: 'MY ORDERS',
        subtitle: "Courier's active and completed orders",
        empty: 'No orders',
        emptyHint: 'Tap "TAKE" on the orders page',
        inWork: 'In progress',
        completed: 'Completed',
        done: 'Done',
        enroute: 'En route',
        enrouteActive: 'En route',
        closeTitle: 'Close order',
        closeBody: 'Are you sure you want to close order №{{number}}?',
        yesDone: 'Yes, done',
    },
    settings: {
        title: 'Settings',
        soundSection: 'Notification sound',
        soundLabel: 'New orders sound',
        on: 'On',
        off: 'Off',
        langSection: 'Interface language',
        themeSection: 'App theme',
        themeDark: 'Dark',
        themeLight: 'Light',
        autosaveNote: 'All changes are saved automatically',
    },
    toast: {
        assignedTitle: 'Order assigned to you',
        open: 'Open',
    },
};

const lv = {
    common: { error: 'Kļūda', cancel: 'Atcelt', delete: 'Dzēst', save: 'Saglabāt', retry: 'Mēģināt vēlreiz', dash: '—' },
    tabs: { menu: 'IZVĒLNE', all: 'VISI', my: 'MANI' },
    login: {
        title: 'Pieslēgšanās',
        subtitle: 'Pieslēdzieties kurjera kontam, lai turpinātu',
        loginLabel: 'Lietotājvārds',
        passwordLabel: 'Parole',
        loginPlaceholder: 'E-pasts vai tālrunis',
        passwordPlaceholder: 'Ievadiet paroli',
        signIn: 'Pieslēgties',
        signingIn: 'Notiek...',
        errEnterCredentials: 'Lūdzu, ievadiet lietotājvārdu un paroli',
        errNoToken: 'Serveris neatgrieza marķieri',
        errLogin: 'Pieslēgšanās kļūda',
        errNetwork: 'Tīkla kļūda',
        errTryLater: 'Mēģiniet vēlāk',
    },
    shift: {
        loading: 'Notiek kurjera datu ielāde...',
        courier: 'Kurjers',
        wsOnline: '● Tiešsaistē',
        wsConnecting: '○ Savienojas...',
        onShift: 'MAIŅĀ',
        offline: 'BEZSAISTĒ',
        manageTitle: 'Maiņas pārvaldība',
        manageSubtitle: 'Ieslēdziet un izslēdziet darba maiņu, pārvaldiet statusu un izrakstīšanos.',
        start: 'Sākt maiņu',
        stop: 'Apturēt maiņu',
        logout: 'Iziet no konta',
        idLabel: 'ID',
        fgTitle: 'Maiņa aktīva',
        fgBody: 'Notiek atrašanās vietas pārsūtīšana pasūtījumiem.',
        permFg: 'Nepieciešama atrašanās vietas atļauja',
        permBg: 'Nepieciešama fona atrašanās vietas atļauja',
        errStartFail: 'Neizdevās sākt maiņu',
        errStopFail: 'Neizdevās apturēt maiņu',
        errLogoutFail: 'Neizdevās iziet. Mēģiniet vēlreiz.',
        takeSuccessTitle: 'Veiksmīgi',
        takeSuccessBody: 'Pasūtījums pievienots jūsu pasūtījumiem',
        removeTitle: 'Dzēst pasūtījumu?',
        removeBody: 'Pasūtījums tiks atteikts un kļūs pieejams citiem kurjeriem.',
    },
    allOrders: {
        title: 'PASŪTĪJUMI',
        subtitle: 'Izvēlieties izsniegšanas punktu',
        allOutlets: 'Visi punkti',
        allActive: 'Visi aktīvie izsniegšanas punkti',
        openList: 'Atvērt punkta pasūtījumus',
        allPill: 'VISI',
    },
    ordersList: {
        allOrders: 'Visi pasūtījumi',
        activeSuffix: 'aktīvie',
        loading: 'Notiek pasūtījumu ielāde...',
        empty: 'Nav pieejamu pasūtījumu',
        emptyHint: 'Kad parādīsies jauni pasūtījumi, tie tiks rādīti šeit',
        statusNew: 'Jauns',
        statusReady: 'Gatavs',
        statusEnroute: 'Ceļā',
        statusCancelled: 'Atcelts',
        captionDelivery: 'izsniegšana',
        captionAccepted: 'pieņemts',
        acceptedAt: 'pieņemts {{time}}',
        captionCurrent: 'pašreizējais',
        justNow: 'tikko',
        minAgo: '{{m}} min',
        hourMin: '{{h}}h {{m}}m',
    },
    report: {
        title: 'Dienas atskaite',
        loading: 'Ielādē atskaiti…',
        error: 'Neizdevās ielādēt atskaiti',
        empty: 'Šodien vēl nav pabeigtu pasūtījumu',
        retry: 'Mēģināt vēlreiz',
        summary: 'Mana dienas kopsavilkums',
        byCourier: 'Pa kurjeriem',
        cash: 'Skaidra nauda',
        card: 'Terminālis (karte)',
        wire: 'Pārskaitījums',
        total: 'Kopā',
        orders: 'Pasūtījumi',
        items: 'Pozīcijas',
        courier: 'Kurjers',
        unassigned: 'Bez kurjera',
    },
    orderDetails: {
        order: 'PASŪTĪJUMS',
        outlet: 'Punkts',
        created: 'izveidots',
        deliver: 'piegādāt',
        call: 'Zvans',
        waze: 'Waze',
        take: 'ŅEMT',
        address: 'Adrese',
        intercom: 'Domofons / kods',
        comment: 'Komentārs',
        items: 'Pasūtījuma sastāvs',
        noItems: 'Pozīcijas nav atrastas.',
        discountLine: 'atlaide {{percent}}%',
        subtotal: 'Kopā par pasūtījumu',
        discount: 'Atlaide',
        total: 'Kopā jāmaksā',
        loading: 'Notiek pasūtījuma ielāde...',
        cash: 'Skaidra nauda',
        card: 'Karte',
        statusNew: 'Jauns',
        statusReady: 'Gatavs',
        statusActive: 'Darbā',
        statusCompleted: 'Pabeigts',
        statusCancelled: 'Atcelts',
    },
    myOrders: {
        title: 'MANI PASŪTĪJUMI',
        subtitle: 'Kurjera aktīvie un pabeigtie pasūtījumi',
        empty: 'Nav pasūtījumu',
        emptyHint: 'Spiediet "ŅEMT" pasūtījumu lapā',
        inWork: 'Darbā',
        completed: 'Pabeigts',
        done: 'Gatavs',
        enroute: 'Ceļā',
        enrouteActive: 'Ceļā',
        closeTitle: 'Aizvērt pasūtījumu',
        closeBody: 'Vai tiešām vēlaties aizvērt pasūtījumu №{{number}}?',
        yesDone: 'Jā, gatavs',
    },
    settings: {
        title: 'Iestatījumi',
        soundSection: 'Paziņojumu skaņa',
        soundLabel: 'Jaunu pasūtījumu skaņa',
        on: 'Ieslēgts',
        off: 'Izslēgts',
        langSection: 'Saskarnes valoda',
        themeSection: 'Lietotnes tēma',
        themeDark: 'Tumšā',
        themeLight: 'Gaišā',
        autosaveNote: 'Visas izmaiņas tiek saglabātas automātiski',
    },
    toast: {
        assignedTitle: 'Jums piešķirts pasūtījums',
        open: 'Atvērt',
    },
};

const TRANSLATIONS = { ru, en, lv };

function getByPath(obj, path) {
    return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

function interpolate(str, params) {
    if (!params) return str;
    return str.replace(/\{\{(\w+)\}\}/g, (_, k) => (params[k] != null ? String(params[k]) : ''));
}

export function translate(lang, key, params) {
    const dict = TRANSLATIONS[lang] || TRANSLATIONS[DEFAULT_LANG];
    let val = getByPath(dict, key);
    if (val == null) val = getByPath(TRANSLATIONS[DEFAULT_LANG], key); // запасной язык
    if (typeof val !== 'string') return key;
    return interpolate(val, params);
}

const I18nContext = createContext({
    lang: DEFAULT_LANG,
    setLang: () => {},
    t: (key) => key,
    ready: true,
});

export function LanguageProvider({ children }) {
    const [lang, setLangState] = useState(DEFAULT_LANG);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const saved = await AsyncStorage.getItem(LANG_KEY);
                if (LANGUAGES.includes(saved)) setLangState(saved);
            } catch (e) {
                // остаёмся на языке по умолчанию
            } finally {
                setReady(true);
            }
        })();
    }, []);

    const setLang = useCallback((l) => {
        if (!LANGUAGES.includes(l)) return;
        setLangState(l);
        AsyncStorage.setItem(LANG_KEY, l).catch(() => {});
    }, []);

    const t = useCallback((key, params) => translate(lang, key, params), [lang]);

    const value = useMemo(() => ({ lang, setLang, t, ready }), [lang, setLang, t, ready]);

    return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT() {
    return useContext(I18nContext);
}
