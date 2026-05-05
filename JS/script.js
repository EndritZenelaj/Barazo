/* ============================================================
   BARAZO POS v3.0 — Script
   3-Step Flow: Staff & Table → Order → Admin
   localStorage persistence · VAT extraction (18%) · Receipt
   ============================================================ */

'use strict';

// ── CONFIGURATION ──────────────────────────────────────────
const PIN_KORREKT  = "123456";
const TOTAL_TABLES = 20;

let pinAktual = "";

// State persisted in localStorage
let punetoret         = JSON.parse(localStorage.getItem("barazo_staff"))    || ["Endriti", "Liridoni"];
let faturatEPerfunduara = JSON.parse(localStorage.getItem("barazo_invoices")) || [];

// Session state
let faturaAktuale    = [];
let kamarieriZgjedhur = "";
let tavolinaZgjedhur  = 0;

let tableStates = JSON.parse(localStorage.getItem("barazo_table_states")) || {};

function siguroStatusinETavoline() {
    for (let i = 1; i <= TOTAL_TABLES; i++) {
        const key = String(i);
        if (!tableStates[key]) {
            tableStates[key] = {
                status: "free",
                waiter: "",
                order: [],
                savedAt: null
            };
        }
    }
}

function ruajTavolina() {
    localStorage.setItem("barazo_table_states", JSON.stringify(tableStates));
}

function getTabelaState(id) {
    const key = String(id);
    if (!tableStates[key]) {
        tableStates[key] = {
            status: "free",
            waiter: "",
            order: [],
            savedAt: null
        };
    }
    return tableStates[key];
}

function clearTabelaState(id) {
    const key = String(id);
    tableStates[key] = {
        status: "free",
        waiter: "",
        order: [],
        savedAt: null
    };
    ruajTavolina();
}

function rifreskoAksionetCart() {
    const saveBtn  = document.getElementById("btn-save-order");
    const payBtn   = document.getElementById("btn-pay-order");
    const printBtn = document.getElementById("btn-print-pay");
    const hasOrder = faturaAktuale.length > 0;
    const validSelection = kamarieriZgjedhur && tavolinaZgjedhur;

    if (saveBtn) {
        saveBtn.disabled = !(validSelection && hasOrder);
    }
    if (payBtn) {
        payBtn.disabled = !(validSelection && hasOrder);
    }
    if (printBtn) {
        printBtn.disabled = !(validSelection && hasOrder);
    }
}

// ── MENU DATA ─────────────────────────────────────────────
const menuDizajni = {
    "Kafe": [
        { emri: "Makiato e Madhe", cmimi: 1.50, ikona: "☕" },
        { emri: "Makiato e Vogël", cmimi: 1.00, ikona: "☕" },
        { emri: "Espresso",        cmimi: 1.00, ikona: "☕" },
        { emri: "Kapuçino",        cmimi: 1.50, ikona: "☕" }
    ],
    "Pije": [
        { emri: "Koka Kola",  cmimi: 2.00, ikona: "🥤" },
        { emri: "Fanta",      cmimi: 2.00, ikona: "🥤" },
        { emri: "Ujë 0.5l",   cmimi: 1.00, ikona: "💧" },
        { emri: "Ujë Gazuar", cmimi: 1.50, ikona: "💧" },
        { emri: "Lëng Portokalli", cmimi: 2.50, ikona: "🍊" }
    ],
    "Ushqim": [
        { emri: "Byrek me Djathë", cmimi: 2.50, ikona: "🥧" },
        { emri: "Byrek me Mish",   cmimi: 3.00, ikona: "🥧" },
        { emri: "Sanduiç",         cmimi: 3.50, ikona: "🥪" }
    ],
    "Embëlsira": [
        { emri: "Trileqe",    cmimi: 2.00, ikona: "🍰" },
        { emri: "Milka Cake", cmimi: 2.50, ikona: "🍰" },
        { emri: "Tiramisu",   cmimi: 3.00, ikona: "🍮" }
    ]
};

const categoryEmoji = {
    "Kafe": "☕", "Pije": "🥤", "Ushqim": "🥧", "Embëlsira": "🍰"
};

// ── PERSISTENCE HELPERS ──────────────────────────────────────
function ruajStafin() {
    localStorage.setItem("barazo_staff", JSON.stringify(punetoret));
}

function ruajFaturat() {
    localStorage.setItem("barazo_invoices", JSON.stringify(faturatEPerfunduara));
}

// ── TOAST SYSTEM ─────────────────────────────────────────────
let toastTimer = null;

function showToast(message, type = "default", duration = 2800) {
    const toast = document.getElementById("toast");
    if (!toast) return;

    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.className = `toast ${type}`;

    void toast.offsetWidth;
    toast.classList.add("show");

    toastTimer = setTimeout(() => {
        toast.classList.remove("show");
    }, duration);
}

// ── CONFIRM MODAL SYSTEM ────────────────────────────────────
let confirmResolve = null;

function showConfirm(title, message, { danger = false } = {}) {
    return new Promise(resolve => {
        confirmResolve = resolve;
        document.getElementById("confirm-title").textContent = title;
        document.getElementById("confirm-message").textContent = message;

        const iconWrap = document.getElementById("confirm-icon-wrap");
        const okBtn = document.getElementById("confirm-ok");

        if (danger) {
            iconWrap.classList.add("danger");
            okBtn.classList.add("danger");
            okBtn.textContent = "Fshi";
        } else {
            iconWrap.classList.remove("danger");
            okBtn.classList.remove("danger");
            okBtn.textContent = "Konfirmo";
        }

        document.getElementById("confirm-ok").onclick = () => {
            const res = confirmResolve;
            confirmResolve = null;
            document.getElementById("confirm-modal").classList.add("hidden");
            if (res) res(true);
        };

        document.getElementById("confirm-modal").classList.remove("hidden");
    });
}

function mbyllModal() {
    document.getElementById("confirm-modal").classList.add("hidden");
    if (confirmResolve) {
        const res = confirmResolve;
        confirmResolve = null;
        res(false);
    }
}

// ── LIVE CLOCK ────────────────────────────────────────────────
function updateClock() {
    const el = document.getElementById("live-time");
    if (!el) return;
    const now = new Date();
    el.textContent = now.toLocaleTimeString("sq-AL", {
        hour: "2-digit", minute: "2-digit", second: "2-digit"
    });
}

setInterval(updateClock, 1000);
updateClock();

// ── KEYBOARD SUPPORT ──────────────────────────────────────────
window.addEventListener("keydown", (e) => {
    if (!document.getElementById("login-overlay").classList.contains("hidden")) {
        if (e.key >= "0" && e.key <= "9") shtoPin(parseInt(e.key));
        else if (e.key === "Backspace") fshijPin();
        else if (e.key === "Escape") mbyllLogin();
        return;
    }

    if (!document.getElementById("confirm-modal").classList.contains("hidden") && e.key === "Escape") {
        mbyllModal();
    }
});

// ── AUTH / LOGIN ──────────────────────────────────────────────
function hapiLogin() {
    pinAktual = "";
    rifreskoDots();
    document.getElementById("pin-error").classList.add("hidden");
    document.getElementById("login-overlay").classList.remove("hidden");
    document.getElementById("login-overlay").focus();
}

function mbyllLogin() {
    document.getElementById("login-overlay").classList.add("hidden");
    pinAktual = "";
    rifreskoDots();
}

function shtoPin(numri) {
    if (pinAktual.length >= 6) return;

    pinAktual += String(numri);
    rifreskoDots();

    const btn = document.getElementById(`pin-btn-${numri}`);
    if (btn) {
        btn.style.transform = "scale(0.88)";
        setTimeout(() => (btn.style.transform = ""), 150);
    }

    if (pinAktual.length === 6) {
        setTimeout(() => {
            if (pinAktual === PIN_KORREKT) {
                mbyllLogin();
                shfaqTab("admin");
            } else {
                document.querySelectorAll(".pin-dot").forEach(d => {
                    d.classList.add("error");
                    setTimeout(() => d.classList.remove("error"), 500);
                });
                document.getElementById("pin-error").classList.remove("hidden");
                pinAktual = "";
                setTimeout(() => rifreskoDots(), 500);
            }
        }, 80);
    }
}

function fshijPin() {
    pinAktual = pinAktual.slice(0, -1);
    rifreskoDots();
    document.getElementById("pin-error").classList.add("hidden");
}

function rifreskoDots() {
    document.querySelectorAll(".pin-dot").forEach((dot, i) => {
        dot.classList.toggle("active", i < pinAktual.length);
    });
}

// ── NAVIGATION ────────────────────────────────────────────────
function shfaqTab(tab) {
    document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));

    const tabId = tab === "admin" ? "tab-admin" : "tab-pos";
    document.getElementById(tabId).classList.add("active");

    document.querySelectorAll(".tab-btn").forEach(b => {
        b.classList.remove("active");
        b.setAttribute("aria-selected", "false");
    });

    const activeBtn = document.getElementById(tab === "admin" ? "btn-admin" : "btn-pos");
    if (activeBtn) {
        activeBtn.classList.add("active");
        activeBtn.setAttribute("aria-selected", "true");
    }

    if (tab === "pos") {
        siguroStatusinETavoline();
        // Show step 1 (selection) or step 2 depending on state
        if (kamarieriZgjedhur && tavolinaZgjedhur) {
            tregoPasin(2);
        } else {
            tregoPasin(1);
        }
    }

    rifreskoUI();
}

// ── 3-STEP FLOW ──────────────────────────────────────────────

function tregoPasin(step) {
    const step1 = document.getElementById("step-selection");
    const step2 = document.getElementById("step-order");

    if (step === 1) {
        step1.classList.remove("hidden");
        step2.classList.add("hidden");
        rifreskoStaffGrid();
        rifreskoTableGrid();
        rifreshoProceedBar();
    } else if (step === 2) {
        step1.classList.add("hidden");
        step2.classList.remove("hidden");
        // Update context bar
        rifreskoContextBar();
        // Update cart context label
        rifreskoCartLabel();
        shfaqKategorite();
    }
}

/* ── Staff Grid (Step 1) ── */
function rifreskoStaffGrid() {
    const grid = document.getElementById("staff-grid");
    if (!grid) return;
    grid.innerHTML = "";

    if (punetoret.length === 0) {
        grid.innerHTML = `<p class="staff-empty-msg">Nuk ka punëtorë. Shto nga paneli Admin.</p>`;
        return;
    }

    punetoret.forEach(p => {
        const btn = document.createElement("button");
        btn.className = "staff-pill" + (kamarieriZgjedhur === p ? " selected" : "");
        btn.type = "button";
        btn.setAttribute("aria-pressed", kamarieriZgjedhur === p ? "true" : "false");
        btn.innerHTML = `
            <span class="staff-pill-avatar">${p.charAt(0).toUpperCase()}</span>
            ${p}
        `;
        btn.onclick = () => {
            kamarieriZgjedhur = (kamarieriZgjedhur === p) ? "" : p;
            rifreskoStaffGrid();
            rifreshoProceedBar();
            autoProceedIfSelectionComplete();
        };
        grid.appendChild(btn);
    });
}

/* ── Table Grid (Step 1) ── */
function rifreskoTableGrid() {
    const grid = document.getElementById("table-grid");
    if (!grid) return;
    grid.innerHTML = "";

    for (let i = 1; i <= TOTAL_TABLES; i++) {
        const state = getTabelaState(i);
        const occupied = state.status === "occupied" && state.order.length > 0;
        const card = document.createElement("button");
        card.type = "button";
        card.className = "table-card" + (tavolinaZgjedhur === i ? " selected" : "") + (occupied ? " occupied" : "");
        card.setAttribute("aria-pressed", tavolinaZgjedhur === i ? "true" : "false");
        card.setAttribute("aria-label", `Tavolina ${i}`);
        card.innerHTML = `
            <span class="table-card-num">${i}</span>
            <span class="table-card-label">Tavolina</span>
            <span class="table-card-status">${occupied ? `E zënë · ${state.order.length} artikuj` : "E lirë"}</span>
        `;
        card.onclick = () => {
            tavolinaZgjedhur = (tavolinaZgjedhur === i) ? 0 : i;
            if (tavolinaZgjedhur) {
                const selectedState = getTabelaState(tavolinaZgjedhur);
                faturaAktuale = [...selectedState.order];
                if (!kamarieriZgjedhur && selectedState.waiter) {
                    kamarieriZgjedhur = selectedState.waiter;
                }
            }
            rifreskoTableGrid();
            rifreshoProceedBar();
            autoProceedIfSelectionComplete();
        };
        grid.appendChild(card);
    }
}

/* ── Proceed Bar ── */
function rifreshoProceedBar() {
    const btn     = document.getElementById("btn-proceed");
    const summary = document.getElementById("selection-summary");
    if (!summary) return;

    if (btn) {
        btn.disabled = !(kamarieriZgjedhur && tavolinaZgjedhur);
    }

    if (kamarieriZgjedhur && tavolinaZgjedhur) {
        summary.innerHTML = `
            <div class="summary-active">
                <span class="summary-tag summary-tag-waiter">
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    ${kamarieriZgjedhur}
                </span>
                <span class="summary-tag summary-tag-table">
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
                    Tavolina #${tavolinaZgjedhur}
                </span>
            </div>
        `;
    } else {
        let msg = "Zgjidhni kamarierin dhe tavolinën për të vazhduar";
        if (kamarieriZgjedhur && !tavolinaZgjedhur) msg = `${kamarieriZgjedhur} ✓ — Zgjidhni tani tavolinën`;
        else if (!kamarieriZgjedhur && tavolinaZgjedhur) msg = `Tavolina #${tavolinaZgjedhur} ✓ — Zgjidhni tani kamarierin`;
        summary.innerHTML = `<span class="summary-placeholder">${msg}</span>`;
    }
}

function autoProceedIfSelectionComplete() {
    if (!kamarieriZgjedhur || !tavolinaZgjedhur) return;

    const stepSelection = document.getElementById("step-selection");
    if (!stepSelection || stepSelection.classList.contains("hidden")) return;

    const selectedState = getTabelaState(tavolinaZgjedhur);
    faturaAktuale = [...selectedState.order];
    tregoPasin(2);
    rifreskoFaturen();
}

function ktheTeZgjedhja() {
    tregoPasin(1);
}

/* ── Context Bar (Step 2) ── */
function rifreskoContextBar() {
    const ci = document.getElementById("context-info");
    if (!ci) return;
    ci.innerHTML = `
        <span class="context-tag context-tag-waiter">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            Kamarieri: <strong>${kamarieriZgjedhur}</strong>
        </span>
        <span class="context-tag context-tag-table">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
            Tavolina: <strong>#${tavolinaZgjedhur}</strong>
        </span>
    `;
}

function rifreskoCartLabel() {
    const lbl = document.getElementById("cart-context-label");
    if (lbl && kamarieriZgjedhur && tavolinaZgjedhur) {
        lbl.textContent = `${kamarieriZgjedhur} · Tryeza #${tavolinaZgjedhur}`;
    }
}

// ── MENU & CART ───────────────────────────────────────────────
function shfaqKategorite() {
    const div = document.getElementById("menu-prmajtja");
    if (!div) return;

    document.getElementById("titulli-menus").textContent = "Menuja";
    document.getElementById("menu-subtitle").textContent = "Zgjidhni kategorinë";
    document.getElementById("btn-back").classList.add("hidden");

    div.innerHTML = "";

    Object.keys(menuDizajni).forEach(kat => {
        const count = menuDizajni[kat].length;
        const card  = document.createElement("button");
        card.className = "category-card";
        card.type = "button";
        card.setAttribute("role", "listitem");
        card.setAttribute("aria-label", `Kategoria ${kat}, ${count} produkte`);
        card.onclick = () => shfaqProduktet(kat);
        card.innerHTML = `
            <div class="category-count">${count} item</div>
            <span class="category-emoji">${categoryEmoji[kat] || "🍽️"}</span>
            <span class="category-name">${kat}</span>
        `;
        div.appendChild(card);
    });
}

function shfaqProduktet(k) {
    const div = document.getElementById("menu-prmajtja");
    document.getElementById("titulli-menus").textContent = k;
    document.getElementById("menu-subtitle").textContent = `${menuDizajni[k].length} produkte`;
    document.getElementById("btn-back").classList.remove("hidden");
    div.innerHTML = "";

    menuDizajni[k].forEach(p => {
        const card = document.createElement("button");
        card.type  = "button";
        card.className = "product-card";
        card.setAttribute("role", "listitem");
        card.setAttribute("aria-label", `${p.emri}, ${p.cmimi.toFixed(2)} euro`);
        card.onclick = () => {
            card.classList.add("added");
            setTimeout(() => card.classList.remove("added"), 500);
            shtoNeFature(p.emri, p.cmimi);
        };
        card.innerHTML = `
            <span class="product-emoji">${p.ikona}</span>
            <span class="product-name">${p.emri}</span>
            <span class="product-price">${p.cmimi.toFixed(2)} €</span>
        `;
        div.appendChild(card);
    });
}

function shtoNeFature(emri, cmimi) {
    faturaAktuale.push({ produkti: emri, cmimi });
    rifreskoFaturen();

    const badge = document.getElementById("cart-count");
    badge.classList.remove("bump");
    void badge.offsetWidth;
    badge.classList.add("bump");
}

function rifreskoFaturen() {
    const div     = document.getElementById("lista-fatures");
    const emptyEl = document.getElementById("cart-empty");
    const badge   = document.getElementById("cart-count");
    let totali = 0;

    Array.from(div.querySelectorAll(".cart-item")).forEach(el => el.remove());

    if (faturaAktuale.length === 0) {
        emptyEl.style.display = "";
        badge.textContent = "0";
    } else {
        emptyEl.style.display = "none";
        badge.textContent = faturaAktuale.length;

        faturaAktuale.forEach((item, index) => {
            totali += item.cmimi;
            const itemEl = document.createElement("div");
            itemEl.className = "cart-item";
            itemEl.setAttribute("role", "listitem");
            itemEl.innerHTML = `
                <div class="cart-item-left">
                    <div class="cart-item-dot"></div>
                    <span class="cart-item-name">${item.produkti}</span>
                </div>
                <div class="cart-item-right">
                    <span class="cart-item-price">${item.cmimi.toFixed(2)} €</span>
                    <button class="cart-item-remove" onclick="hiqNgaFatura(${index})" aria-label="Hiq ${item.produkti}">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>
            `;
            div.appendChild(itemEl);
        });
    }

    const totalEl = document.getElementById("totali-fatures");
    totalEl.textContent = totali.toFixed(2) + " €";
    if (faturaAktuale.length > 0) {
        totalEl.classList.remove("bump");
        void totalEl.offsetWidth;
        totalEl.classList.add("bump");
    }
    rifreskoAksionetCart();
}

function hiqNgaFatura(i) {
    faturaAktuale.splice(i, 1);
    rifreskoFaturen();
}

// ── RESET SESSION STATE ───────────────────────────────────────
function resetSessionState() {
    faturaAktuale = [];
    kamarieriZgjedhur = "";
    tavolinaZgjedhur = 0;
    rifreskoFaturen();
    rifreskoAksionetCart();
    rifreskoCartLabel();
}

function createInvoicePayload() {
    const now = new Date();
    const saleId = Date.now();
    const grandTotal = faturaAktuale.reduce((s, i) => s + i.cmimi, 0);

    return {
        id:        saleId,
        punetori:  kamarieriZgjedhur,
        tavolina:  tavolinaZgjedhur,
        produktet: [...faturaAktuale],
        total:     grandTotal,
        koha:      now.toLocaleTimeString("sq-AL", { hour: "2-digit", minute: "2-digit" }),
        data:      now.toLocaleDateString("sq-AL", { day: "2-digit", month: "2-digit", year: "numeric" })
    };
}

function mbyllFaturen() {
    document.getElementById("receipt-overlay").classList.add("hidden");
    tregoPasin(1);
    rifreskoUI();
}

function handlePaymentSubmission({ showReceipt = false } = {}) {
    const invoice = createInvoicePayload();
    faturatEPerfunduara.push(invoice);
    ruajFaturat();
    clearTabelaState(tavolinaZgjedhur);
    rifreskoTableGrid();
    rifreskoAksionetCart();

    if (showReceipt) {
        resetSessionState();
        hapiFaturen({ ...invoice, grandTotal: invoice.total, now: new Date(), timeStr: invoice.koha });
        showToast(`✓ Fatura po përgatitet.`, "success");
        return;
    }

    resetSessionState();
    showToast(`✓ Porosia u pagua. Tavolina #${invoice.tavolina} është e lirë.`, "success");
    setTimeout(() => {
        tregoPasin(1);
        rifreskoUI();
    }, 700);
}

// ── CONFIRM ORDER & RECEIPT ───────────────────────────────────
function konfirmoPorosine() {
    if (!kamarieriZgjedhur) {
        showToast("⚠️ Nuk ka kamarier të zgjedhur!", "warning");
        return;
    }
    if (!tavolinaZgjedhur) {
        showToast("⚠️ Nuk ka tavolinë të zgjedhur!", "warning");
        return;
    }
    if (faturaAktuale.length === 0) {
        showToast("⚠️ Shto produkte në porosinë!", "warning");
        return;
    }

    const now = new Date();
    tableStates[String(tavolinaZgjedhur)] = {
        status: "occupied",
        waiter: kamarieriZgjedhur,
        order: [...faturaAktuale],
        savedAt: now.toISOString()
    };
    ruajTavolina();
    rifreskoTableGrid();
    rifreskoAksionetCart();

    const saveBtn = document.getElementById("btn-save-order");
    if (saveBtn) {
        saveBtn.classList.add("success-tick");
        setTimeout(() => saveBtn.classList.remove("success-tick"), 900);
    }
    showToast(`✓ Porosia u ruajt. Tavolina #${tavolinaZgjedhur} është e zënë.`, "success");

    setTimeout(() => {
        resetSessionState();
        tregoPasin(1);
        rifreskoUI();
    }, 700);
}

function paguajPorosine() {
    if (!kamarieriZgjedhur) {
        showToast("⚠️ Nuk ka kamarier të zgjedhur!", "warning");
        return;
    }
    if (!tavolinaZgjedhur) {
        showToast("⚠️ Nuk ka tavolinë të zgjedhur!", "warning");
        return;
    }
    if (faturaAktuale.length === 0) {
        showToast("⚠️ Shto produkte në porosinë!", "warning");
        return;
    }

    handlePaymentSubmission({ showReceipt: false });
}

function gjeneroFaturenFinale() {
    if (!kamarieriZgjedhur) {
        showToast("⚠️ Nuk ka kamarier të zgjedhur!", "warning");
        return;
    }
    if (!tavolinaZgjedhur) {
        showToast("⚠️ Nuk ka tavolinë të zgjedhur!", "warning");
        return;
    }
    if (faturaAktuale.length === 0) {
        showToast("⚠️ Shto produkte në porosinë!", "warning");
        return;
    }

    handlePaymentSubmission({ showReceipt: true });
}

/* ── Populate and show the receipt modal ── */
function hapiFaturen({ id, punetori, tavolina, produktet, grandTotal, now, timeStr, data }) {
    // VAT is inclusive at 18%: base = total / 1.18, vat = total - base
    const base = grandTotal / 1.18;
    const vat  = grandTotal - base;

    document.getElementById("rcpt-id").textContent    = "#" + String(id).slice(-6);
    document.getElementById("rcpt-date").textContent  = data || now.toLocaleDateString("sq-AL", { day: "2-digit", month: "2-digit", year: "numeric" });
    document.getElementById("rcpt-time").textContent  = timeStr;
    document.getElementById("rcpt-waiter").textContent = punetori;
    document.getElementById("rcpt-table").textContent  = tavolina ? `#${tavolina}` : "—";

    // Group identical items for qty rows
    const grouped = [];
    produktet.forEach(p => {
        const existing = grouped.find(g => g.emri === p.produkti);
        if (existing) {
            existing.qty++;
            existing.subtotal += p.cmimi;
        } else {
            grouped.push({ emri: p.produkti, cmimi: p.cmimi, qty: 1, subtotal: p.cmimi });
        }
    });

    const tbody = document.getElementById("rcpt-items");
    tbody.innerHTML = "";
    grouped.forEach(item => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td class="rcpt-td rcpt-td-item">${item.emri}</td>
            <td class="rcpt-td rcpt-td-qty">${item.qty}</td>
            <td class="rcpt-td rcpt-td-price">${item.cmimi.toFixed(2)} €</td>
            <td class="rcpt-td rcpt-td-sub">${item.subtotal.toFixed(2)} €</td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById("rcpt-subtotal").textContent = base.toFixed(2) + " €";
    document.getElementById("rcpt-vat").textContent      = vat.toFixed(2) + " €";
    document.getElementById("rcpt-total").textContent    = grandTotal.toFixed(2) + " €";

    document.getElementById("receipt-overlay").classList.remove("hidden");
}

function printReceipt() {
    window.print();
    mbyllFaturen();
}

function porosi_e_re() {
    mbyllFaturen();
}

// ── ADMIN — STAFF MANAGEMENT ──────────────────────────────────
function shtoPunetor() {
    const emri    = document.getElementById("emriRi").value.trim();
    const mbiemri = document.getElementById("mbiemriRi").value.trim();

    if (!emri || !mbiemri) {
        showToast("⚠️ Plotëso emrin dhe mbiemrin!", "warning");
        return;
    }

    const emriFull = `${emri} ${mbiemri}`;
    if (punetoret.includes(emriFull)) {
        showToast("⚠️ Ky punëtor ekziston!", "warning");
        return;
    }

    punetoret.push(emriFull);
    document.getElementById("emriRi").value    = "";
    document.getElementById("mbiemriRi").value = "";
    ruajStafin();
    rifreskoUI();
    showToast(`✓ ${emriFull} u shtua!`, "success");
}

async function fshijPunetor(index) {
    const confirmed = await showConfirm(
        "Fshi Punëtorin",
        `A jeni i sigurt që dëshironi të fshini "${punetoret[index]}"? Ky veprim nuk mund të kthehet.`,
        { danger: true }
    );
    if (!confirmed) return;

    const name = punetoret[index];
    punetoret.splice(index, 1);
    ruajStafin();
    rifreskoUI();
    showToast(`🗑 ${name} u fshi.`, "error");
}

// ── UI REFRESH ────────────────────────────────────────────────
function rifreskoUI() {
    // Update admin reports select
    const s2 = document.getElementById("selectBarazo");
    if (s2) {
        const currentVal = s2.value;
        s2.innerHTML = `<option value="">Zgjidhni punëtorin...</option>`;
        punetoret.forEach(p => {
            s2.innerHTML += `<option value="${p}">${p}</option>`;
        });
        if (punetoret.includes(currentVal)) s2.value = currentVal;
    }

    // Staff list in admin panel
    const lista = document.getElementById("lista-stafit");
    if (!lista) return;
    lista.innerHTML = "";

    if (punetoret.length === 0) {
        lista.innerHTML = `<p style="font-size:13px; color:var(--text-muted); text-align:center; padding:24px 0; font-weight:500;">Nuk ka punëtorë.</p>`;
        return;
    }

    punetoret.forEach((p, index) => {
        const initial = p.charAt(0).toUpperCase();
        const item = document.createElement("div");
        item.className = "staff-item";
        item.setAttribute("role", "listitem");
        item.innerHTML = `
            <div class="staff-item-left">
                <div class="staff-avatar">${initial}</div>
                <div>
                    <div class="staff-name">${p}</div>
                    <div class="staff-role">Kamarieri</div>
                </div>
            </div>
            <button class="staff-delete-btn" onclick="fshijPunetor(${index})" aria-label="Fshi ${p}">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    <path d="M10 11v6"/><path d="M14 11v6"/>
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                </svg>
            </button>
        `;
        lista.appendChild(item);
    });

    // Also refresh staff grid if on step 1
    const staffGrid = document.getElementById("staff-grid");
    if (staffGrid && !document.getElementById("step-selection").classList.contains("hidden")) {
        rifreskoStaffGrid();
    }
}

// ── REPORTS ──────────────────────────────────────────────────
function gjeneroRaportin() {
    const emri      = document.getElementById("selectBarazo").value;
    const raporti   = document.getElementById("raporti-final");
    const emptyState = document.getElementById("reports-empty");

    if (!emri) {
        raporti.classList.add("hidden");
        emptyState.style.display = "";
        return;
    }

    raporti.classList.remove("hidden");
    emptyState.style.display = "none";

    const faturat    = faturatEPerfunduara.filter(f => f.punetori === emri);
    const totalXhiro = faturat.reduce((s, f) => s + f.total, 0);
    const mesatarja  = faturat.length > 0 ? totalXhiro / faturat.length : 0;

    document.getElementById("shuma-finale").textContent       = totalXhiro.toFixed(2) + " €";
    document.getElementById("nr-faturave").textContent        = faturat.length;
    document.getElementById("mesatarja-fatures").textContent  = mesatarja.toFixed(2) + " €";

    const det = document.getElementById("detajet-faturave");
    det.innerHTML = "";

    if (faturat.length === 0) {
        det.innerHTML = `<p style="font-size:13px; color:var(--text-muted); text-align:center; padding:24px 0; font-weight:500;">Nuk ka fatura për këtë punëtor.</p>`;
        return;
    }

    [...faturat].reverse().forEach(f => {
        const card = document.createElement("div");
        card.className = "invoice-card";
        card.setAttribute("role", "listitem");
        card.innerHTML = `
            <div class="invoice-left">
                <div class="invoice-meta">
                    <span class="invoice-time">${f.koha}${f.tavolina ? ` · T#${f.tavolina}` : ""}</span>
                    <span class="invoice-amount">${f.total.toFixed(2)} €</span>
                </div>
                <p class="invoice-products">${f.produktet.map(p => p.produkti).join(", ")}</p>
            </div>
            <div class="invoice-actions">
                <button class="invoice-btn invoice-btn-edit" onclick="editoFaturen(${f.id})">Edito</button>
                <button class="invoice-btn invoice-btn-delete" onclick="fshijFaturen(${f.id})">Fshi</button>
            </div>
        `;
        det.appendChild(card);
    });
}

function editoFaturen(id) {
    showConfirm(
        "Kthe Faturën",
        "A dëshironi të ktheni këtë faturë për modifikim? Ajo do të largohet nga raportet.",
        { danger: false }
    ).then(confirmed => {
        if (!confirmed) return;
        const f = faturatEPerfunduara.find(x => x.id === id);
        if (!f) return;

        faturaAktuale     = [...f.produktet];
        kamarieriZgjedhur = f.punetori;
        tavolinaZgjedhur  = f.tavolina || 0;
        faturatEPerfunduara = faturatEPerfunduara.filter(x => x.id !== id);

        if (tavolinaZgjedhur) {
            tableStates[String(tavolinaZgjedhur)] = {
                status: "occupied",
                waiter: kamarieriZgjedhur,
                order: [...f.produktet],
                savedAt: new Date().toISOString()
            };
            ruajTavolina();
        }

        ruajFaturat();
        shfaqTab("pos");
        setTimeout(() => {
            rifreskoFaturen();
            rifreskoContextBar();
            rifreskoCartLabel();
        }, 100);

        showToast("↩ Fatura u kthye për modifikim.", "default");
    });
}

async function fshijFaturen(id) {
    const confirmed = await showConfirm(
        "Fshi Faturën",
        "A jeni i sigurt? Kjo faturë do të fshihet përgjithmonë dhe nuk mund të kthehet.",
        { danger: true }
    );
    if (!confirmed) return;

    faturatEPerfunduara = faturatEPerfunduara.filter(f => f.id !== id);
    ruajFaturat();
    gjeneroRaportin();
    showToast("🗑 Fatura u fshi.", "error");
}

async function mbyllDiten() {
    const emri = document.getElementById("selectBarazo").value;
    if (!emri) return;

    const confirmed = await showConfirm(
        "Mbyll Ditën",
        `A jeni i sigurt? Të gjitha faturat e "${emri}" do të fshihen nga sistemi.`,
        { danger: true }
    );
    if (!confirmed) return;

    faturatEPerfunduara = faturatEPerfunduara.filter(f => f.punetori !== emri);
    ruajFaturat();
    gjeneroRaportin();
    showToast(`✓ Dita e "${emri}" u mbyll me sukses.`, "success");
}

// ── INIT ──────────────────────────────────────────────────────
window.addEventListener("load", () => {
    shfaqTab("pos");
    rifreskoUI();
});