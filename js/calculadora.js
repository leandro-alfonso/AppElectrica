(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const watts = $("watts");
  const voltage = $("voltage");
  const loadType = $("loadType");
  const result = $("calcResult");
  const calculateBtn = $("calculateBtn");

  function calculate() {
    if (!watts || !voltage || !loadType || !result) return;
    const W = Number(watts.value);
    const V = Number(voltage.value);

    if (!W || !V) {
      result.innerHTML = "<div class=\"result-box\">Ingresá potencia y tensión.</div>";
      return;
    }

    const A = W / V;
    const breakers = [6, 10, 16, 20, 25, 32, 40, 50, 63];
    const min = breakers.find((x) => x >= A) || 63;
    const rec = breakers.find((x) => x >= A * 1.25) || min;

    let cable = A <= 14 ? "1,5 mm²" : A <= 20 ? "2,5 mm²" : A <= 26 ? "4 mm²" : A <= 34 ? "6 mm²" : "10 mm²";

    if (loadType.value === "lighting") cable = "1,5 mm² (mínimo de iluminación general)";
    if (loadType.value === "motor") cable = A <= 18 ? "2,5 mm²" : A <= 26 ? "4 mm²" : A <= 34 ? "6 mm²" : "10 mm²";

    result.innerHTML = `
      <div class="result-box"><small>Corriente calculada</small><strong>${A.toFixed(2)} A</strong></div>
      <div class="result-box"><small>Térmica mínima por corriente</small><strong>${min} A</strong></div>
      <div class="result-box"><small>Referencia recomendada*</small><strong>${rec} A</strong></div>
      <div class="result-box"><small>Sección orientativa*</small><strong>${cable}</strong></div>`;
  }

  function init() {
    calculateBtn?.addEventListener("click", calculate);
    [watts, voltage, loadType].forEach((el) => el?.addEventListener("input", calculate));
    calculate();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
