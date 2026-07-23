"use strict";

/* آدرس فایل CSV منتشرشده از Google Sheet */
const GOOGLE_SHEET_URL =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vRULrojEZLgtKk-T0DkFu0fJlXZoWystL0wYlDEwv78YIN1Q-1HmEMQny8lSYBITNPMHp-3Ym638D_y/pub?output=csv";

/* فاصله بروزرسانی خودکار: ۶۰ ثانیه */
const AUTO_REFRESH_INTERVAL = 60 * 1000;

/* وضعیت برنامه */
let headers = [];
let marketData = [];

let symbolColumnIndex = -1;
let companyNameColumnIndex = -1;
let marketPercentColumnIndex = -1;

let sortState = {
    columnIndex: null,
    direction: "asc"
};

let isLoading = false;

/* عناصر صفحه */
const marketTable = document.getElementById("marketTable");
const searchTable = document.getElementById("searchTable");

const searchInput = document.getElementById("searchInput");
const clearSearchButton = document.getElementById("clearSearchButton");
const refreshButton = document.getElementById("refreshButton");

const statusMessage = document.getElementById("statusMessage");
const lastUpdate = document.getElementById("lastUpdate");

const totalCount = document.getElementById("totalCount");
const positiveCount = document.getElementById("positiveCount");
const negativeCount = document.getElementById("negativeCount");
const neutralCount = document.getElementById("neutralCount");

const searchResultsSection = document.getElementById(
    "searchResultsSection"
);

const searchResultCount = document.getElementById(
    "searchResultCount"
);

const noSearchResult = document.getElementById(
    "noSearchResult"
);

/**
 * تبدیل اعداد فارسی و عربی به انگلیسی
 */
function convertToEnglishDigits(value) {
    const persianDigits = "۰۱۲۳۴۵۶۷۸۹";
    const arabicDigits = "٠١٢٣٤٥٦٧٨٩";

    return String(value)
        .replace(/[۰-۹]/g, digit =>
            persianDigits.indexOf(digit)
        )
        .replace(/[٠-٩]/g, digit =>
            arabicDigits.indexOf(digit)
        );
}

/**
 * یکسان‌سازی متن فارسی برای جستجو و تشخیص عنوان ستون‌ها
 */
function normalizePersianText(value) {
    return convertToEnglishDigits(value ?? "")
        .replace(/ي/g, "ی")
        .replace(/ك/g, "ک")
        .replace(/\u200c/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
}

/**
 * پارس کردن صحیح CSV
 * این تابع کاماهای داخل کوتیشن را نیز مدیریت می‌کند.
 */
function parseCSV(csvText) {
    const rows = [];

    let currentRow = [];
    let currentCell = "";
    let insideQuotes = false;

    for (let index = 0; index < csvText.length; index++) {
        const character = csvText[index];
        const nextCharacter = csvText[index + 1];

        if (character === '"') {
            if (insideQuotes && nextCharacter === '"') {
                currentCell += '"';
                index++;
            } else {
                insideQuotes = !insideQuotes;
            }

            continue;
        }

        if (character === "," && !insideQuotes) {
            currentRow.push(currentCell.trim());
            currentCell = "";
            continue;
        }

        if (
            (character === "\n" || character === "\r") &&
            !insideQuotes
        ) {
            if (
                character === "\r" &&
                nextCharacter === "\n"
            ) {
                index++;
            }

            currentRow.push(currentCell.trim());

            if (currentRow.some(cell => cell !== "")) {
                rows.push(currentRow);
            }

            currentRow = [];
            currentCell = "";
            continue;
        }

        currentCell += character;
    }

    currentRow.push(currentCell.trim());

    if (currentRow.some(cell => cell !== "")) {
        rows.push(currentRow);
    }

    return rows;
}

/**
 * تبدیل متن عددی به Number
 */
function parseNumericValue(value) {
    if (value === null || value === undefined) {
        return null;
    }

    let normalizedValue = convertToEnglishDigits(value)
        .replace(/٬/g, "")
        .replace(/,/g, "")
        .replace(/٪/g, "")
        .replace(/%/g, "")
        .replace(/\s/g, "")
        .replace(/−/g, "-")
        .trim();

    let isNegativeByParentheses = false;

    if (
        normalizedValue.startsWith("(") &&
        normalizedValue.endsWith(")")
    ) {
        isNegativeByParentheses = true;
        normalizedValue = normalizedValue.slice(1, -1);
    }

    if (!/^[+-]?\d+(\.\d+)?$/.test(normalizedValue)) {
        return null;
    }

    let numericValue = Number(normalizedValue);

    if (!Number.isFinite(numericValue)) {
        return null;
    }

    if (isNegativeByParentheses) {
        numericValue *= -1;
    }

    return numericValue;
}

/**
 * تشخیص ستون‌هایی که باید جداکننده هزارگان داشته باشند
 */
function shouldFormatAsNumber(header) {
    const normalizedHeader = normalizePersianText(header);

    const numberKeywords = [
        "تعداد",
        "حجم",
        "ارزش",
        "قیمت",
        "دیروز",
        "اولین",
        "آخرین",
        "پایانی",
        "خرید",
        "فروش",
        "کمترین",
        "بیشترین",
        "حداقل",
        "حداکثر"
    ];

    const excludedKeywords = [
        "نماد",
        "نام",
        "تاریخ",
        "زمان",
        "ساعت",
        "کد"
    ];

    const isExcluded = excludedKeywords.some(keyword =>
        normalizedHeader.includes(keyword)
    );

    if (isExcluded) {
        return false;
    }

    return numberKeywords.some(keyword =>
        normalizedHeader.includes(keyword)
    );
}

/**
 * تشخیص ستون درصدی یا تغییر قیمت
 */
function isChangeColumn(header) {
    const normalizedHeader = normalizePersianText(header);

    return (
        normalizedHeader.includes("درصد") ||
        normalizedHeader.includes("تغییر")
    );
}

/**
 * قالب‌بندی عدد با جداکننده هزارگان
 */
function formatNumber(value) {
    return new Intl.NumberFormat("fa-IR", {
        maximumFractionDigits: 4
    }).format(value);
}

/**
 * قالب‌بندی مقدار هر سلول
 */
function formatCellValue(value, columnIndex) {
    const numericValue = parseNumericValue(value);

    if (numericValue === null) {
        return value;
    }

    const header = headers[columnIndex] ?? "";

    if (
        shouldFormatAsNumber(header) ||
        isChangeColumn(header)
    ) {
        return formatNumber(numericValue);
    }

    return value;
}

/**
 * پیدا کردن ستون‌های مهم بر اساس عنوان
 */
function detectImportantColumns() {
    symbolColumnIndex = headers.findIndex(header => {
        const normalizedHeader = normalizePersianText(header);

        return (
            normalizedHeader === "نماد" ||
            normalizedHeader.includes("نماد")
        );
    });

    companyNameColumnIndex = headers.findIndex(header => {
        const normalizedHeader = normalizePersianText(header);

        return (
            normalizedHeader === "نام" ||
            normalizedHeader.includes("نام شرکت") ||
            normalizedHeader.includes("نام")
        );
    });

    marketPercentColumnIndex = headers.findIndex(header => {
        const normalizedHeader = normalizePersianText(header);

        return (
            normalizedHeader.includes("درصد") &&
            normalizedHeader.includes("آخرین")
        );
    });

    /*
     * اگر ستون درصد آخرین معامله پیدا نشد،
     * ستون درصد قیمت پایانی استفاده می‌شود.
     */
    if (marketPercentColumnIndex === -1) {
        marketPercentColumnIndex = headers.findIndex(header => {
            const normalizedHeader =
                normalizePersianText(header);

            return (
                normalizedHeader.includes("درصد") &&
                normalizedHeader.includes("پایانی")
            );
        });
    }

    /*
     * در نسخه قبلی ستون درصد آخرین معامله
     * ستون شماره ۹ بود. اگر عنوان پیدا نشد،
     * از همان ستون استفاده می‌کنیم.
     */
    if (
        marketPercentColumnIndex === -1 &&
        headers.length > 9
    ) {
        marketPercentColumnIndex = 9;
    }
}

/**
 * ایجاد Header جدول
 */
function createTableHeader(table) {
    const tableHead = table.querySelector("thead");
    tableHead.textContent = "";

    const row = document.createElement("tr");

    headers.forEach((header, columnIndex) => {
        const th = document.createElement("th");
        const button = document.createElement("button");
        const title = document.createElement("span");
        const icon = document.createElement("span");

        button.type = "button";
        button.className = "sort-button";
        button.title = `مرتب‌سازی بر اساس ${header}`;

        title.textContent = header || `ستون ${columnIndex + 1}`;

        icon.className = "sort-icon";

        if (sortState.columnIndex === columnIndex) {
            icon.textContent =
                sortState.direction === "asc" ? "▲" : "▼";
        } else {
            icon.textContent = "↕";
        }

        button.appendChild(title);
        button.appendChild(icon);

        button.addEventListener("click", () => {
            changeSort(columnIndex);
        });

        th.appendChild(button);
        row.appendChild(th);
    });

    tableHead.appendChild(row);
}

/**
 * اضافه کردن کلاس مثبت، منفی یا خنثی به سلول
 */
function applyValueColor(cell, value, columnIndex) {
    const header = headers[columnIndex] ?? "";

    if (!isChangeColumn(header)) {
        return;
    }

    const numericValue = parseNumericValue(value);

    if (numericValue === null) {
        return;
    }

    if (numericValue > 0) {
        cell.classList.add("positive");
    } else if (numericValue < 0) {
        cell.classList.add("negative");
    } else {
        cell.classList.add("neutral");
    }
}

/**
 * ساخت بدنه جدول
 */
function createTableBody(table, rows) {
    const tableBody = table.querySelector("tbody");
    tableBody.textContent = "";

    const fragment = document.createDocumentFragment();

    rows.forEach(rowData => {
        const row = document.createElement("tr");

        headers.forEach((header, columnIndex) => {
            const cell = document.createElement("td");
            const originalValue = rowData[columnIndex] ?? "";

            cell.textContent = formatCellValue(
                originalValue,
                columnIndex
            );

            applyValueColor(
                cell,
                originalValue,
                columnIndex
            );

            row.appendChild(cell);
        });

        fragment.appendChild(row);
    });

    tableBody.appendChild(fragment);
}

/**
 * نمایش کامل یک جدول
 */
function renderTable(table, rows) {
    createTableHeader(table);
    createTableBody(table, rows);
}

/**
 * مقایسه دو مقدار برای مرتب‌سازی
 */
function compareValues(firstValue, secondValue) {
    const firstNumber = parseNumericValue(firstValue);
    const secondNumber = parseNumericValue(secondValue);

    if (firstNumber !== null && secondNumber !== null) {
        return firstNumber - secondNumber;
    }

    return normalizePersianText(firstValue).localeCompare(
        normalizePersianText(secondValue),
        "fa",
        {
            numeric: true,
            sensitivity: "base"
        }
    );
}

/**
 * مرتب کردن داده‌ها بر اساس وضعیت فعلی
 */
function getSortedData(rows) {
    if (sortState.columnIndex === null) {
        return [...rows];
    }

    return [...rows].sort((firstRow, secondRow) => {
        const result = compareValues(
            firstRow[sortState.columnIndex] ?? "",
            secondRow[sortState.columnIndex] ?? ""
        );

        return sortState.direction === "asc"
            ? result
            : -result;
    });
}

/**
 * تغییر مرتب‌سازی با کلیک روی Header
 */
function changeSort(columnIndex) {
    if (sortState.columnIndex === columnIndex) {
        sortState.direction =
            sortState.direction === "asc" ? "desc" : "asc";
    } else {
        sortState.columnIndex = columnIndex;
        sortState.direction = "asc";
    }

    renderAllTables();
}

/**
 * دریافت نتایج جستجو
 */
function getSearchResults(searchText) {
    const normalizedSearch =
        normalizePersianText(searchText);

    if (!normalizedSearch) {
        return [];
    }

    return marketData.filter(row => {
        const symbol =
            symbolColumnIndex >= 0
                ? row[symbolColumnIndex] ?? ""
                : "";

        const companyName =
            companyNameColumnIndex >= 0
                ? row[companyNameColumnIndex] ?? ""
                : "";

        /*
         * اگر ستون نماد و نام تشخیص داده نشد،
         * در تمام ستون‌ها جستجو انجام می‌شود.
         */
        if (
            symbolColumnIndex === -1 &&
            companyNameColumnIndex === -1
        ) {
            return row.some(cell =>
                normalizePersianText(cell).includes(
                    normalizedSearch
                )
            );
        }

        return (
            normalizePersianText(symbol).includes(
                normalizedSearch
            ) ||
            normalizePersianText(companyName).includes(
                normalizedSearch
            )
        );
    });
}

/**
 * بروزرسانی جدول نتایج جستجو
 */
function renderSearchResults() {
    const searchText = searchInput.value.trim();

    if (!searchText) {
        searchResultsSection.classList.add("hidden");
        noSearchResult.classList.add("hidden");
        return;
    }

    searchResultsSection.classList.remove("hidden");

    const results = getSortedData(
        getSearchResults(searchText)
    );

    searchResultCount.textContent =
        `${formatNumber(results.length)} نتیجه`;

    renderTable(searchTable, results);

    if (results.length === 0) {
        searchTable.classList.add("hidden");
        noSearchResult.classList.remove("hidden");
    } else {
        searchTable.classList.remove("hidden");
        noSearchResult.classList.add("hidden");
    }
}

/**
 * نمایش همه جدول‌ها
 */
function renderAllTables() {
    const sortedMarketData = getSortedData(marketData);

    renderTable(marketTable, sortedMarketData);
    renderSearchResults();
}

/**
 * محاسبه آمار مثبت، منفی و بدون تغییر
 */
function updateMarketSummary() {
    let positives = 0;
    let negatives = 0;
    let neutrals = 0;

    if (marketPercentColumnIndex >= 0) {
        marketData.forEach(row => {
            const value = parseNumericValue(
                row[marketPercentColumnIndex]
            );

            if (value === null) {
                return;
            }

            if (value > 0) {
                positives++;
            } else if (value < 0) {
                negatives++;
            } else {
                neutrals++;
            }
        });
    }

    totalCount.textContent = formatNumber(marketData.length);
    positiveCount.textContent = formatNumber(positives);
    negativeCount.textContent = formatNumber(negatives);
    neutralCount.textContent = formatNumber(neutrals);
}

/**
 * تغییر پیام وضعیت
 */
function setStatus(message, statusType) {
    statusMessage.textContent = message;
    statusMessage.className = `status ${statusType}`;
}

/**
 * نمایش زمان آخرین بروزرسانی
 */
function updateLastUpdateTime() {
    const now = new Date();

    lastUpdate.textContent = new Intl.DateTimeFormat(
        "fa-IR",
        {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
        }
    ).format(now);
}

/**
 * پاک‌سازی و آماده‌سازی اطلاعات CSV
 */
function prepareMarketData(parsedRows) {
    const headerIndex = parsedRows.findIndex(row =>
        row.some(cell =>
            normalizePersianText(cell).includes("نماد")
        )
    );

    if (headerIndex === -1) {
        throw new Error(
            "ردیف Header شامل ستون «نماد» پیدا نشد."
        );
    }

    headers = parsedRows[headerIndex].map(
        (header, index) =>
            header.trim() || `ستون ${index + 1}`
    );

    marketData = parsedRows
        .slice(headerIndex + 1)
        .filter(row =>
            row.some(cell => String(cell).trim() !== "")
        )
        .map(row => {
            const normalizedRow = [...row];

            while (normalizedRow.length < headers.length) {
                normalizedRow.push("");
            }

            return normalizedRow.slice(0, headers.length);
        });

    detectImportantColumns();
}

/**
 * دریافت اطلاعات Google Sheet
 */
async function loadMarketData() {
    if (isLoading) {
        return;
    }

    isLoading = true;
    refreshButton.disabled = true;
    refreshButton.textContent = "در حال بروزرسانی...";

    setStatus(
        "در حال دریافت اطلاعات بازار...",
        "loading"
    );

    try {
        /*
         * افزودن زمان به URL برای جلوگیری از نمایش کش قدیمی
         */
        const requestUrl =
            `${GOOGLE_SHEET_URL}&time=${Date.now()}`;

        const response = await fetch(requestUrl, {
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error(
                `خطا در دریافت اطلاعات: ${response.status}`
            );
        }

        const csvText = await response.text();
        const parsedRows = parseCSV(csvText);

        if (parsedRows.length === 0) {
            throw new Error(
                "اطلاعاتی در Google Sheet پیدا نشد."
            );
        }

        prepareMarketData(parsedRows);
        updateMarketSummary();
        renderAllTables();
        updateLastUpdateTime();

        setStatus(
            `اطلاعات ${formatNumber(marketData.length)} نماد با موفقیت دریافت شد.`,
            "success"
        );
    } catch (error) {
        console.error(error);

        setStatus(
            error.message ||
                "در دریافت اطلاعات بازار خطایی رخ داد.",
            "error"
        );
    } finally {
        isLoading = false;
        refreshButton.disabled = false;
        refreshButton.textContent = "بروزرسانی اطلاعات";
    }
}

/* جستجو هنگام تایپ */
searchInput.addEventListener("input", () => {
    renderSearchResults();
});

/* پاک کردن عبارت جستجو */
clearSearchButton.addEventListener("click", () => {
    searchInput.value = "";
    searchResultsSection.classList.add("hidden");
    noSearchResult.classList.add("hidden");
    searchInput.focus();
});

/* بروزرسانی دستی */
refreshButton.addEventListener("click", () => {
    loadMarketData();
});

/* دریافت اولیه اطلاعات */
loadMarketData();

/* بروزرسانی خودکار */
setInterval(() => {
    loadMarketData();
}, AUTO_REFRESH_INTERVAL);
