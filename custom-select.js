(function (global) {
  const ENHANCED_ATTRIBUTE = "data-sitcheck-select-enhanced";

  function closeAll(exceptWrapper = null) {
    document.querySelectorAll(".sitcheck-select.is-open").forEach((wrapper) => {
      if (wrapper === exceptWrapper) {
        return;
      }

      wrapper.classList.remove("is-open");
      wrapper.querySelector(".sitcheck-select-button")?.setAttribute("aria-expanded", "false");
      const menu = wrapper.querySelector(".sitcheck-select-menu");
      if (menu) {
        menu.hidden = true;
      }
    });
  }

  function refresh(select) {
    if (!select) {
      return;
    }

    const wrapper = select.closest(".sitcheck-select");
    const button = wrapper?.querySelector(".sitcheck-select-button");
    const selectedOption = select.options[select.selectedIndex];

    if (button && selectedOption) {
      button.querySelector(".sitcheck-select-value").textContent = selectedOption.textContent;
    }

    wrapper?.querySelectorAll(".sitcheck-select-option").forEach((optionButton) => {
      const selected = optionButton.dataset.value === select.value;
      optionButton.classList.toggle("is-selected", selected);
      optionButton.setAttribute("aria-selected", selected ? "true" : "false");
    });
  }

  function enhance(select) {
    if (
      !select ||
      select.hasAttribute(ENHANCED_ATTRIBUTE) ||
      select.closest(".sitcheck-select")
    ) {
      return;
    }

    select.setAttribute(ENHANCED_ATTRIBUTE, "true");
    select.classList.add("sitcheck-native-select");
    select.tabIndex = -1;

    const wrapper = document.createElement("div");
    wrapper.className = "sitcheck-select";
    select.parentNode.insertBefore(wrapper, select);
    wrapper.appendChild(select);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "sitcheck-select-button";
    button.setAttribute("aria-haspopup", "listbox");
    button.setAttribute("aria-expanded", "false");
    button.innerHTML = `
      <span class="sitcheck-select-value"></span>
      <span class="sitcheck-select-chevron" aria-hidden="true"></span>
    `;

    const menu = document.createElement("div");
    menu.className = "sitcheck-select-menu";
    menu.setAttribute("role", "listbox");
    menu.hidden = true;

    Array.from(select.options).forEach((option) => {
      const optionButton = document.createElement("button");
      optionButton.type = "button";
      optionButton.className = "sitcheck-select-option";
      optionButton.dataset.value = option.value;
      optionButton.textContent = option.textContent;
      optionButton.setAttribute("role", "option");

      optionButton.addEventListener("click", () => {
        select.value = option.value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
        refresh(select);
        closeAll();
        button.focus();
      });

      menu.appendChild(optionButton);
    });

    button.addEventListener("click", (event) => {
      event.preventDefault();
      const shouldOpen = !wrapper.classList.contains("is-open");
      closeAll(wrapper);
      wrapper.classList.toggle("is-open", shouldOpen);
      button.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
      menu.hidden = !shouldOpen;
    });

    const parentLabel = wrapper.closest("label");
    if (parentLabel) {
      parentLabel.addEventListener("click", (event) => {
        if (event.target.closest(".sitcheck-select")) {
          return;
        }

        event.preventDefault();
        button.click();
      });
    }

    select.addEventListener("change", () => refresh(select));
    wrapper.append(button, menu);
    refresh(select);
  }

  function enhanceWithin(root = document) {
    if (root.matches?.("select")) {
      enhance(root);
    }

    root.querySelectorAll?.("select").forEach(enhance);
  }

  function installStyles() {
    if (document.querySelector("#sitcheck-custom-select-styles")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "sitcheck-custom-select-styles";
    style.textContent = `
      .sitcheck-select {
        position: relative;
        width: 100%;
        min-width: 0;
      }

      .sitcheck-native-select {
        position: absolute !important;
        width: 1px !important;
        height: 1px !important;
        padding: 0 !important;
        margin: -1px !important;
        overflow: hidden !important;
        clip: rect(0, 0, 0, 0) !important;
        white-space: nowrap !important;
        border: 0 !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }

      .sitcheck-select-button {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        width: 100%;
        min-height: 42px;
        padding: 9px 12px;
        border: 1px solid var(--line, #d7e1ee);
        border-radius: 12px;
        background: #fff;
        color: var(--text, #132238);
        font: inherit;
        text-align: left;
        cursor: pointer;
      }

      .sitcheck-select-button:focus-visible {
        outline: 2px solid rgba(36, 87, 245, 0.32);
        outline-offset: 2px;
      }

      .sitcheck-select-chevron {
        width: 9px;
        height: 9px;
        flex: 0 0 auto;
        border-right: 2px solid currentColor;
        border-bottom: 2px solid currentColor;
        transform: rotate(45deg) translateY(-2px);
        transition: transform 150ms ease;
      }

      .sitcheck-select.is-open .sitcheck-select-chevron {
        transform: rotate(225deg) translate(-2px, -2px);
      }

      .sitcheck-select-menu {
        position: absolute;
        left: 0;
        right: 0;
        top: calc(100% + 6px);
        z-index: 250;
        max-height: min(260px, 45vh);
        padding: 6px;
        overflow-y: auto;
        border: 1px solid var(--line, #d7e1ee);
        border-radius: 14px;
        background: #fff;
        box-shadow: 0 18px 40px rgba(19, 34, 56, 0.2);
      }

      .sitcheck-select-menu[hidden] {
        display: none;
      }

      .sitcheck-select-option {
        display: flex;
        align-items: center;
        width: 100%;
        min-height: 42px;
        padding: 9px 11px;
        border: 0;
        border-radius: 9px;
        background: transparent;
        color: var(--text, #132238);
        font: inherit;
        text-align: left;
        cursor: pointer;
      }

      .sitcheck-select-option + .sitcheck-select-option {
        margin-top: 2px;
      }

      .sitcheck-select-option.is-selected {
        background: #eef4ff;
        color: var(--primary, #2457f5);
        font-weight: 700;
      }
    `;
    document.head.appendChild(style);
  }

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".sitcheck-select")) {
      closeAll();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeAll();
    }
  });

  installStyles();
  enhanceWithin();

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          enhanceWithin(node);
        }
      });
    });
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });

  global.SitCheckCustomSelect = {
    enhance,
    enhanceWithin,
    refresh,
    refreshAll() {
      document.querySelectorAll("select").forEach(refresh);
    }
  };
})(window);
