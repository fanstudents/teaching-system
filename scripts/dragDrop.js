/**
 * 拖曳模組
 * 負責元素的拖曳移動與縮放
 */

export class DragDrop {
    constructor(slideManager, editor) {
        this.slideManager = slideManager;
        this.editor = editor;

        this.canvasContentEl = document.getElementById('canvasContent');

        this.isDragging = false;
        this.isResizing = false;
        this.isDraggingWaypoint = false;
        this.isMarquee = false;
        this.activeElement = null;
        this.activeHandle = null;
        this._wpHandle = null;
        this._wpFlowlineId = null;
        this._wpIndex = -1;
        this._wpSnapTarget = null;
        this._multiDragOffsets = [];
        this._altDuplicating = false;
        this._copiedElements = null;

        this.startX = 0;
        this.startY = 0;
        this.startLeft = 0;
        this.startTop = 0;
        this.startWidth = 0;
        this.startHeight = 0;

        this.setupEventListeners();
    }

    setupEventListeners() {
        // 包裝 handler 方法，避免 runtime error 破壞整個編輯器
        const safe = (fn) => (e) => {
            try { fn.call(this, e); } catch (err) {
                console.error('[DragDrop]', err);
                this.forceReset();
            }
        };

        // 使用 pointer events + setPointerCapture 確保不會丟失 pointerup
        this.canvasContentEl.addEventListener('pointerdown', safe(this.handleMouseDown));
        document.addEventListener('pointermove', safe(this.handleMouseMove));
        document.addEventListener('pointerup', safe(this.handleMouseUp));
        // macOS 觸控板快速拖曳時會觸發 pointercancel 而非 pointerup
        document.addEventListener('pointercancel', safe(this.handleMouseUp));

        // 阻止瀏覽器原生拖曳（圖片等）
        this.canvasContentEl.addEventListener('dragstart', e => e.preventDefault());

        // 安全重置
        window.addEventListener('blur', () => this.forceReset());
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) this.forceReset();
        });

        // 雙擊編輯文字
        this.canvasContentEl.addEventListener('dblclick', safe(this.handleDoubleClick));

        // 右鍵選單
        this.canvasContentEl.addEventListener('contextmenu', safe(this.handleContextMenu));
        document.addEventListener('click', () => this._removeContextMenu());
        document.addEventListener('contextmenu', (e) => {
            if (!this.canvasContentEl.contains(e.target)) this._removeContextMenu();
        });

        // 點擊空白處取消選取（但跳過框選後的 click）
        document.getElementById('slideCanvas').addEventListener('click', (e) => {
            if (this._justMarqueed) {
                this._justMarqueed = false;
                return;
            }
            if (e.target.id === 'slideCanvas' || e.target.id === 'canvasContent') {
                this.editor.deselectAll();
            }
        });

        // 鍵盤事件
        document.addEventListener('keydown', safe(this.handleKeyDown));

        // 縮圖被點擊時，取消選取畫布元素
        window.addEventListener('thumbnailClicked', () => this.editor.deselectAll());
    }

    // ── 右鍵選單 ──
    _removeContextMenu() {
        document.querySelectorAll('.editor-context-menu').forEach(m => m.remove());
    }

    handleContextMenu(e) {
        e.preventDefault();
        this._removeContextMenu();

        const element = e.target.closest('.editable-element');
        const hasSelection = this.editor.selectedElements.size > 0;
        const hasCopied = this._copiedElements?.length > 0;
        const isMulti = this.editor.selectedElements.size > 1;

        // 如果右鍵點的元素不在選取中，先選取它
        if (element && !this.editor.selectedElements.has(element)) {
            this.editor.selectElement(element);
        }

        const selectedId = this.editor.selectedElement?.dataset?.id;
        const slide = this.slideManager.getCurrentSlide();
        const elData = selectedId && slide ? slide.elements.find(d => d.id === selectedId) : null;
        const hasGroup = elData?.groupId;

        // 建立選單項目
        const items = [];

        if (element || hasSelection) {
            items.push({ icon: 'content_copy', label: '複製', shortcut: '⌘C', action: 'copy' });
            items.push({ icon: 'content_paste', label: '貼上', shortcut: '⌘V', action: 'paste', disabled: !hasCopied });
            items.push({ icon: 'content_copy', label: '快速複製', shortcut: '⌘D', action: 'duplicate' });
            items.push('---');
            if (!isMulti) {
                items.push({ icon: 'flip_to_front', label: '移至最上層', action: 'bringFront' });
                items.push({ icon: 'flip_to_back', label: '移至最下層', action: 'sendBack' });
                items.push('---');
            }
            if (isMulti) {
                items.push({ icon: 'group_work', label: '群組', shortcut: '⌘G', action: 'group' });
            }
            if (hasGroup) {
                items.push({ icon: 'workspaces', label: '解散群組', shortcut: '⇧⌘G', action: 'ungroup' });
            }
            if (isMulti || hasGroup) items.push('---');
            items.push({ icon: 'delete', label: '刪除', shortcut: '⌫', action: 'delete', danger: true });
        } else {
            // 空白區域右鍵
            items.push({ icon: 'content_paste', label: '貼上', shortcut: '⌘V', action: 'paste', disabled: !hasCopied });
            items.push({ icon: 'select_all', label: '全選', shortcut: '⌘A', action: 'selectAll' });
        }

        // 建立選單 DOM
        const menu = document.createElement('div');
        menu.className = 'editor-context-menu';
        menu.style.cssText = `
            position:fixed; left:${e.clientX}px; top:${e.clientY}px; z-index:10000;
            background:rgba(255,255,255,0.92); backdrop-filter:blur(16px) saturate(180%);
            -webkit-backdrop-filter:blur(16px) saturate(180%);
            border:1px solid rgba(0,0,0,0.08); border-radius:10px;
            padding:6px; min-width:200px; box-shadow:0 8px 30px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06);
            font-family:'Inter','Noto Sans TC',system-ui,sans-serif; font-size:13px;
            animation:ctxFadeIn 0.12s ease;
        `;

        // 注入動畫 CSS（一次性）
        if (!document.getElementById('ctxMenuStyles')) {
            const style = document.createElement('style');
            style.id = 'ctxMenuStyles';
            style.textContent = `
                @keyframes ctxFadeIn { from { opacity:0; transform:scale(0.96); } }
                .ctx-item { display:flex; align-items:center; gap:8px; padding:7px 12px; border-radius:6px;
                    cursor:pointer; transition:background 0.1s; color:#1f2937; border:none; background:none;
                    width:100%; font-size:13px; font-family:inherit; text-align:left; }
                .ctx-item:hover { background:rgba(99,102,241,0.08); }
                .ctx-item.disabled { opacity:0.35; pointer-events:none; }
                .ctx-item.danger { color:#ef4444; }
                .ctx-item.danger:hover { background:rgba(239,68,68,0.08); }
                .ctx-item .material-symbols-outlined { font-size:16px; opacity:0.6; }
                .ctx-item .ctx-shortcut { margin-left:auto; font-size:11px; color:#9ca3af; font-weight:500; }
                .ctx-divider { height:1px; background:rgba(0,0,0,0.06); margin:4px 8px; }
            `;
            document.head.appendChild(style);
        }

        items.forEach(item => {
            if (item === '---') {
                const div = document.createElement('div');
                div.className = 'ctx-divider';
                menu.appendChild(div);
                return;
            }
            const btn = document.createElement('button');
            btn.className = `ctx-item${item.disabled ? ' disabled' : ''}${item.danger ? ' danger' : ''}`;
            btn.innerHTML = `
                <span class="material-symbols-outlined">${item.icon}</span>
                <span>${item.label}</span>
                ${item.shortcut ? `<span class="ctx-shortcut">${item.shortcut}</span>` : ''}
            `;
            btn.addEventListener('click', (ev) => {
                ev.stopPropagation();
                this._removeContextMenu();
                this._executeContextAction(item.action);
            });
            menu.appendChild(btn);
        });

        document.body.appendChild(menu);

        // 確保選單不超出視窗
        requestAnimationFrame(() => {
            const r = menu.getBoundingClientRect();
            if (r.right > window.innerWidth) menu.style.left = `${window.innerWidth - r.width - 8}px`;
            if (r.bottom > window.innerHeight) menu.style.top = `${window.innerHeight - r.height - 8}px`;
        });
    }

    _executeContextAction(action) {
        const slide = this.slideManager.getCurrentSlide();
        if (!slide) return;
        const selectedId = this.editor.selectedElement?.dataset?.id;

        switch (action) {
            case 'copy': {
                this._copiedElements = [...this.editor.selectedElements].map(sel => {
                    const data = slide.elements.find(d => d.id === sel.dataset.id);
                    return data ? JSON.parse(JSON.stringify(data)) : null;
                }).filter(Boolean);
                break;
            }
            case 'paste': {
                if (!this._copiedElements?.length) return;
                const newIds = [];
                this._copiedElements.forEach(dup => {
                    const copy = JSON.parse(JSON.stringify(dup));
                    copy.id = this.slideManager.generateId();
                    copy.groupId = null;
                    copy.x += 20;
                    copy.y += 20;
                    slide.elements.push(copy);
                    newIds.push(copy.id);
                });
                this.slideManager.renderCurrentSlide();
                this.slideManager.renderThumbnails();
                this.editor.deselectAll();
                newIds.forEach(id => {
                    const dom = this.canvasContentEl.querySelector(`[data-id="${id}"]`);
                    if (dom) { this.editor.selectedElements.add(dom); dom.classList.add('selected'); }
                });
                if (this.editor.selectedElements.size > 0)
                    this.editor.selectedElement = [...this.editor.selectedElements][0];
                break;
            }
            case 'duplicate': {
                // 模擬 Cmd+D
                const ev = new KeyboardEvent('keydown', { key: 'd', metaKey: true, bubbles: true });
                document.dispatchEvent(ev);
                break;
            }
            case 'delete': {
                const ids = [...this.editor.selectedElements].map(el => el.dataset.id).filter(Boolean);
                this.editor.deselectAll();
                if (ids.length > 1) {
                    this.slideManager.deleteElementsBatch(ids);
                } else if (ids.length === 1) {
                    this.slideManager.deleteElement(ids[0]);
                }
                break;
            }
            case 'bringFront': {
                if (selectedId) {
                    const idx = slide.elements.findIndex(e => e.id === selectedId);
                    if (idx >= 0 && idx < slide.elements.length - 1) {
                        const [el] = slide.elements.splice(idx, 1);
                        slide.elements.push(el);
                        this.slideManager.renderCurrentSlide();
                        this.slideManager.renderThumbnails();
                        this.editor.selectElementById(selectedId);
                    }
                }
                break;
            }
            case 'sendBack': {
                if (selectedId) {
                    const idx = slide.elements.findIndex(e => e.id === selectedId);
                    if (idx > 0) {
                        const [el] = slide.elements.splice(idx, 1);
                        slide.elements.unshift(el);
                        this.slideManager.renderCurrentSlide();
                        this.slideManager.renderThumbnails();
                        this.editor.selectElementById(selectedId);
                    }
                }
                break;
            }
            case 'group': {
                this.editor.groupSelected();
                break;
            }
            case 'ungroup': {
                this.editor.ungroupSelected();
                break;
            }
            case 'selectAll': {
                const ev = new KeyboardEvent('keydown', { key: 'a', metaKey: true, bubbles: true });
                document.dispatchEvent(ev);
                break;
            }
        }
    }

    _doPasteElements() {
        const slide = this.slideManager.getCurrentSlide();
        if (!slide || !this._copiedElements?.length) return;
        const newIds = [];
        this._copiedElements.forEach(data => {
            const dup = JSON.parse(JSON.stringify(data));
            dup.id = this.slideManager.generateId();
            dup.groupId = null;
            dup.x += 20;
            dup.y += 20;
            slide.elements.push(dup);
            newIds.push(dup.id);
        });
        this.slideManager.renderCurrentSlide();
        this.slideManager.renderThumbnails();
        this.editor.deselectAll();
        const canvas = this.canvasContentEl;
        newIds.forEach(id => {
            const dom = canvas.querySelector(`[data-id="${id}"]`);
            if (dom) { this.editor.selectedElements.add(dom); dom.classList.add('selected'); }
        });
        if (this.editor.selectedElements.size > 0) {
            this.editor.selectedElement = [...this.editor.selectedElements][0];
            if (this.editor.selectedElements.size === 1) {
                this.editor.addResizeHandles(this.editor.selectedElement);
                this.editor.showPropertyPanel(this.editor.selectedElement);
            } else {
                this.editor.showMultiSelectPanel();
            }
        }
    }

    forceReset() {
        if (this.isDragging && this.activeElement) {
            this.activeElement.style.cursor = 'move';
        }
        this.isDragging = false;
        this.isResizing = false;
        this.isDraggingWaypoint = false;
        this.isMarquee = false;
        this.activeElement = null;
        this.activeHandle = null;
        this._wpHandle = null;
        this._wpFlowlineId = null;
        this._wpIndex = -1;
        this._wpSnapTarget = null;
        this._multiDragOffsets = [];
        this._altDuplicating = false;
        this._pointerId = null;
        document.querySelectorAll('.snap-guide').forEach(g => g.remove());
        document.querySelectorAll('.flowline-snap-highlight').forEach(h => h.remove());
        document.querySelectorAll('.marquee-rect').forEach(m => m.remove());
    }

    handleMouseDown(e) {
        // ── Waypoint handle 拖曳 ──
        const wpHandle = e.target.closest('.flowline-waypoint-handle');
        if (wpHandle) {
            this.isDraggingWaypoint = true;
            this._wpHandle = wpHandle;
            this._wpFlowlineId = wpHandle.dataset.flowlineId;
            this._wpIndex = parseInt(wpHandle.dataset.waypointIndex);
            this._wpSnapTarget = null;
            this.startX = e.clientX;
            this.startY = e.clientY;
            this._wpStartLeft = parseInt(wpHandle.style.left) || 0;
            this._wpStartTop = parseInt(wpHandle.style.top) || 0;
            wpHandle.style.cursor = 'grabbing';
            wpHandle.style.transform = 'scale(1.4)';
            this._pointerId = e.pointerId;
            try { wpHandle.setPointerCapture(e.pointerId); } catch (_) { }
            e.preventDefault();
            e.stopPropagation();
            return;
        }

        const element = e.target.closest('.editable-element');
        const handle = e.target.closest('.resize-handle');

        if (handle && this.editor.selectedElement) {
            // 開始 resize
            this.isResizing = true;
            this.activeElement = this.editor.selectedElement;
            this.activeHandle = handle.dataset.handle;

            this.startX = e.clientX;
            this.startY = e.clientY;
            this.startLeft = parseInt(this.activeElement.style.left) || 0;
            this.startTop = parseInt(this.activeElement.style.top) || 0;
            this.startWidth = this.activeElement.offsetWidth;
            this.startHeight = this.activeElement.offsetHeight;

            // 鎖定 pointer — 確保 pointerup 不會丟失
            this._pointerId = e.pointerId;
            try { handle.setPointerCapture(e.pointerId); } catch (_) { }

            e.preventDefault();
            e.stopPropagation();
            return;
        }

        if (element) {
            // 如果此元素正在編輯中，略過拖曳
            if (element.contentEditable === 'true' || element.classList.contains('editing')) {
                return;
            }

            // Shift+click 多選
            if (e.shiftKey) {
                this.editor.selectElement(element, true);
                e.preventDefault();
                return;
            }

            // 如果元素已在多選集合中，不重新單選
            if (this.editor.selectedElements.has(element)) {
                // 不改變選取
            } else {
                this.editor.selectElement(element);
            }

            // 如果是互動元件內的元素，不拖曳
            if (e.target.closest('.matching-item') || e.target.closest('.fill-blank-input')) {
                return;
            }

            // Alt+drag 複製
            if (e.altKey && this.editor.selectedElements.size > 0) {
                this._altDuplicating = true;
                const slide = this.slideManager.getCurrentSlide();
                if (slide) {
                    // 先記錄要複製的元素數量（deselectAll 會清空）
                    const originalCount = this.editor.selectedElements.size;
                    const dupsToMake = [...this.editor.selectedElements].map(sel => {
                        const data = slide.elements.find(d => d.id === sel.dataset.id);
                        return data ? JSON.parse(JSON.stringify(data)) : null;
                    }).filter(Boolean);

                    const newIds = [];
                    dupsToMake.forEach(dup => {
                        dup.id = this.slideManager.generateId();
                        dup.groupId = null;
                        dup.x += 20;
                        dup.y += 20;
                        slide.elements.push(dup);
                        newIds.push(dup.id);
                    });

                    this.slideManager.renderCurrentSlide();
                    this.editor.deselectAll();
                    const canvas = this.canvasContentEl;
                    newIds.forEach(id => {
                        const dom = canvas.querySelector(`[data-id="${id}"]`);
                        if (dom) {
                            this.editor.selectedElements.add(dom);
                            dom.classList.add('selected');
                        }
                    });
                    if (this.editor.selectedElements.size > 0) {
                        this.editor.selectedElement = [...this.editor.selectedElements][0];
                    }
                    // 更新 element ref 指向新複製的 DOM（因 renderCurrentSlide 重建了 DOM）
                    element = this.editor.selectedElement;
                    if (!element) return;
                }
            }

            // 多元素拖曳設定
            this.isDragging = true;
            this.activeElement = element;
            this.startX = e.clientX;
            this.startY = e.clientY;
            this.startLeft = parseInt(element.style.left) || 0;
            this.startTop = parseInt(element.style.top) || 0;

            // 記錄所有選取元素的初始位置
            this._multiDragOffsets = [];
            this.editor.selectedElements.forEach(sel => {
                this._multiDragOffsets.push({
                    el: sel,
                    startLeft: parseInt(sel.style.left) || 0,
                    startTop: parseInt(sel.style.top) || 0
                });
            });

            // 鎖定 pointer
            this._pointerId = e.pointerId;
            try { element.setPointerCapture(e.pointerId); } catch (_) { }

            element.style.cursor = 'grabbing';
            e.preventDefault();
        } else {
            // 點擊空白處 → 開始框選 (marquee)
            const canvasRect = this.canvasContentEl.getBoundingClientRect();
            const x = e.clientX - canvasRect.left;
            const y = e.clientY - canvasRect.top;
            // 只在畫布內容區域內開始框選
            if (x >= 0 && y >= 0 && x <= canvasRect.width && y <= canvasRect.height) {
                this.isMarquee = true;
                this._marqueeStartX = x;
                this._marqueeStartY = y;
                this.startX = e.clientX;
                this.startY = e.clientY;
                this.editor.deselectAll();

                // 建立框選視覺元素
                const rect = document.createElement('div');
                rect.className = 'marquee-rect';
                rect.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:0;height:0;`;
                this.canvasContentEl.appendChild(rect);
                e.preventDefault();
            }
        }
    }

    handleMouseMove(e) {
        // ★ 終極保險
        if ((this.isDragging || this.isResizing || this.isDraggingWaypoint || this.isMarquee) && e.buttons === 0) {
            this.forceReset();
            return;
        }

        // ── 框選 ──
        if (this.isMarquee) {
            e.preventDefault();
            const canvasRect = this.canvasContentEl.getBoundingClientRect();
            const curX = e.clientX - canvasRect.left;
            const curY = e.clientY - canvasRect.top;
            const x = Math.min(this._marqueeStartX, curX);
            const y = Math.min(this._marqueeStartY, curY);
            const w = Math.abs(curX - this._marqueeStartX);
            const h = Math.abs(curY - this._marqueeStartY);

            const rect = this.canvasContentEl.querySelector('.marquee-rect');
            if (rect) {
                rect.style.left = `${x}px`;
                rect.style.top = `${y}px`;
                rect.style.width = `${w}px`;
                rect.style.height = `${h}px`;
            }
            return;
        }

        // ── Waypoint handle 拖曳 ──
        if (this.isDraggingWaypoint && this._wpHandle) {
            e.preventDefault();
            const dx = e.clientX - this.startX;
            const dy = e.clientY - this.startY;
            const newLeft = this._wpStartLeft + dx;
            const newTop = this._wpStartTop + dy;
            this._wpHandle.style.left = `${newLeft}px`;
            this._wpHandle.style.top = `${newTop}px`;

            // 自動吸附偵測：找最近的其他元素
            const SNAP_DIST = 20;
            const flowlineEl = this._wpHandle.closest('.editable-element');
            const flowlineData = this.slideManager.getCurrentSlide()?.elements.find(e => e.id === this._wpFlowlineId);
            if (!flowlineData) return;

            // waypoint 的絕對座標
            const absX = flowlineData.x + newLeft + 8; // center of handle
            const absY = flowlineData.y + newTop + 8;

            // 移除舊的 snap 高亮
            document.querySelectorAll('.flowline-snap-highlight').forEach(h => h.remove());
            this._wpSnapTarget = null;

            const canvas = this.canvasContentEl;
            const siblings = canvas.querySelectorAll('.slide-element');
            let bestDist = SNAP_DIST;
            let bestEl = null;
            let bestEdge = null;

            siblings.forEach(sib => {
                if (sib === flowlineEl) return;
                const sibData = this.slideManager.getCurrentSlide()?.elements.find(e => e.id === sib.dataset.id);
                if (!sibData || sibData.type === 'flowline') return;

                const cx = sibData.x + sibData.width / 2;
                const cy = sibData.y + sibData.height / 2;
                const edges = [
                    { x: cx, y: sibData.y },
                    { x: cx, y: sibData.y + sibData.height },
                    { x: sibData.x, y: cy },
                    { x: sibData.x + sibData.width, y: cy },
                ];
                for (const edge of edges) {
                    const d = Math.hypot(edge.x - absX, edge.y - absY);
                    if (d < bestDist) {
                        bestDist = d;
                        bestEl = sibData;
                        bestEdge = edge;
                    }
                }
            });

            if (bestEl && bestEdge) {
                this._wpSnapTarget = { elementId: bestEl.id, edge: bestEdge };
                // 顯示吸附高亮
                const highlight = document.createElement('div');
                highlight.className = 'flowline-snap-highlight';
                highlight.style.cssText = `
                    position:absolute;
                    left:${bestEl.x - 3}px;top:${bestEl.y - 3}px;
                    width:${bestEl.width + 6}px;height:${bestEl.height + 6}px;
                    border:2px solid #10b981;border-radius:6px;
                    pointer-events:none;z-index:9998;
                    box-shadow:0 0 8px rgba(16,185,129,0.4);
                `;
                canvas.appendChild(highlight);

                // 吸附 handle 到邊緣
                const snapLocalX = bestEdge.x - flowlineData.x - 8;
                const snapLocalY = bestEdge.y - flowlineData.y - 8;
                this._wpHandle.style.left = `${snapLocalX}px`;
                this._wpHandle.style.top = `${snapLocalY}px`;
            }
            return;
        }

        if (this.isDragging && this.activeElement) {
            e.preventDefault();
            const dx = e.clientX - this.startX;
            const dy = e.clientY - this.startY;

            let newLeft = this.startLeft + dx;
            let newTop = this.startTop + dy;

            // 邊界限制
            const canvas = this.canvasContentEl;
            const maxLeft = canvas.offsetWidth - this.activeElement.offsetWidth;
            const maxTop = canvas.offsetHeight - this.activeElement.offsetHeight;

            newLeft = Math.max(0, Math.min(newLeft, maxLeft));
            newTop = Math.max(0, Math.min(newTop, maxTop));

            // ── 對齊輔助線 ──
            const SNAP = 8;
            const elW = this.activeElement.offsetWidth;
            const elH = this.activeElement.offsetHeight;
            const elCX = newLeft + elW / 2;
            const elCY = newTop + elH / 2;
            const canvasW = canvas.offsetWidth;
            const canvasH = canvas.offsetHeight;

            // 移除舊輔助線
            canvas.querySelectorAll('.snap-guide').forEach(g => g.remove());

            const guides = [];

            // 畫布中心吸附
            if (Math.abs(elCX - canvasW / 2) < SNAP) {
                newLeft = canvasW / 2 - elW / 2;
                guides.push({ type: 'v', pos: canvasW / 2 });
            }
            if (Math.abs(elCY - canvasH / 2) < SNAP) {
                newTop = canvasH / 2 - elH / 2;
                guides.push({ type: 'h', pos: canvasH / 2 });
            }

            // 其他元素吸附
            const siblings = canvas.querySelectorAll('.slide-element');
            siblings.forEach(sib => {
                if (sib === this.activeElement || this.editor.selectedElements.has(sib)) return;
                const sL = sib.offsetLeft, sT = sib.offsetTop;
                const sW = sib.offsetWidth, sH = sib.offsetHeight;
                const sCX = sL + sW / 2, sCY = sT + sH / 2;

                // 垂直對齊（左、中、右）
                if (Math.abs(newLeft - sL) < SNAP) { newLeft = sL; guides.push({ type: 'v', pos: sL }); }
                else if (Math.abs(elCX - sCX) < SNAP) { newLeft = sCX - elW / 2; guides.push({ type: 'v', pos: sCX }); }
                else if (Math.abs(newLeft + elW - (sL + sW)) < SNAP) { newLeft = sL + sW - elW; guides.push({ type: 'v', pos: sL + sW }); }

                // 水平對齊（上、中、下）
                if (Math.abs(newTop - sT) < SNAP) { newTop = sT; guides.push({ type: 'h', pos: sT }); }
                else if (Math.abs(elCY - sCY) < SNAP) { newTop = sCY - elH / 2; guides.push({ type: 'h', pos: sCY }); }
                else if (Math.abs(newTop + elH - (sT + sH)) < SNAP) { newTop = sT + sH - elH; guides.push({ type: 'h', pos: sT + sH }); }
            });

            // 繪製輔助線
            guides.forEach(g => {
                const line = document.createElement('div');
                line.className = 'snap-guide';
                if (g.type === 'v') {
                    line.style.cssText = `position:absolute;left:${g.pos}px;top:0;width:0;height:100%;border-left:1px dashed #1a73e8;z-index:9999;pointer-events:none;opacity:0.8;`;
                } else {
                    line.style.cssText = `position:absolute;top:${g.pos}px;left:0;width:100%;height:0;border-top:1px dashed #1a73e8;z-index:9999;pointer-events:none;opacity:0.8;`;
                }
                canvas.appendChild(line);
            });

            this.activeElement.style.left = `${newLeft}px`;
            this.activeElement.style.top = `${newTop}px`;

            // 多元素同步移動
            const actualDx = newLeft - this.startLeft;
            const actualDy = newTop - this.startTop;
            this._multiDragOffsets.forEach(item => {
                if (item.el !== this.activeElement && item.el?.isConnected) {
                    item.el.style.left = `${item.startLeft + actualDx}px`;
                    item.el.style.top = `${item.startTop + actualDy}px`;
                }
            });
        }

        if (this.isResizing && this.activeElement) {
            const dx = e.clientX - this.startX;
            const dy = e.clientY - this.startY;

            let newWidth = this.startWidth;
            let newHeight = this.startHeight;
            let newLeft = this.startLeft;
            let newTop = this.startTop;

            const handle = this.activeHandle;
            const isCorner = ['nw', 'ne', 'sw', 'se'].includes(handle);
            const isImage = this.activeElement.dataset.type === 'image';
            const aspectRatio = this.startWidth / this.startHeight;

            // 根據 handle 位置計算新尺寸
            if (handle.includes('e')) {
                newWidth = Math.max(50, this.startWidth + dx);
            }
            if (handle.includes('w')) {
                newWidth = Math.max(50, this.startWidth - dx);
                newLeft = this.startLeft + (this.startWidth - newWidth);
            }
            if (handle.includes('s')) {
                newHeight = Math.max(30, this.startHeight + dy);
            }
            if (handle.includes('n')) {
                newHeight = Math.max(30, this.startHeight - dy);
                newTop = this.startTop + (this.startHeight - newHeight);
            }

            // 圖片/素材 corner resize → 等比縮放
            if (isImage && isCorner) {
                newHeight = Math.round(newWidth / aspectRatio);
                if (handle.includes('n')) {
                    newTop = this.startTop + this.startHeight - newHeight;
                }
            }

            this.activeElement.style.width = `${newWidth}px`;
            this.activeElement.style.height = `${newHeight}px`;
            this.activeElement.style.left = `${newLeft}px`;
            this.activeElement.style.top = `${newTop}px`;
        }
    }

    handleMouseUp(e) {
        // ── 框選完成 ──
        if (this.isMarquee) {
            const rect = this.canvasContentEl.querySelector('.marquee-rect');
            if (rect) {
                const rL = parseInt(rect.style.left);
                const rT = parseInt(rect.style.top);
                const rW = parseInt(rect.style.width);
                const rH = parseInt(rect.style.height);

                if (rW > 5 && rH > 5) {
                    // 找出框內所有元素
                    const canvas = this.canvasContentEl;
                    canvas.querySelectorAll('.slide-element').forEach(el => {
                        const eL = el.offsetLeft;
                        const eT = el.offsetTop;
                        const eW = el.offsetWidth;
                        const eH = el.offsetHeight;

                        // 交集檢查
                        if (eL < rL + rW && eL + eW > rL && eT < rT + rH && eT + eH > rT) {
                            this.editor.selectedElements.add(el);
                            el.classList.add('selected');
                        }
                    });

                    if (this.editor.selectedElements.size > 0) {
                        this.editor.selectedElement = [...this.editor.selectedElements][0];
                        if (this.editor.selectedElements.size === 1) {
                            this.editor.addResizeHandles(this.editor.selectedElement);
                            this.editor.showPropertyPanel(this.editor.selectedElement);
                        } else {
                            this.editor.showMultiSelectPanel();
                        }
                    }
                }

                rect.remove();
            }
            this.isMarquee = false;
            this._justMarqueed = true; // 防止接下來的 click 對消框選
            return;
        }
        // ── Waypoint handle 拖曳完成 ──
        if (this.isDraggingWaypoint && this._wpHandle) {
            this._wpHandle.style.cursor = 'grab';
            this._wpHandle.style.transform = '';

            const flowlineData = this.slideManager.getCurrentSlide()?.elements.find(e => e.id === this._wpFlowlineId);
            if (flowlineData) {
                const pts = [...flowlineData.waypoints];
                const handleSize = (this._wpIndex === 0 || this._wpIndex === pts.length - 1) ? 8 : 7;
                const newLocalX = parseInt(this._wpHandle.style.left) + handleSize;
                const newLocalY = parseInt(this._wpHandle.style.top) + handleSize;
                pts[this._wpIndex] = { x: newLocalX, y: newLocalY };

                const updates = { waypoints: pts };

                // 設定吸附 ID
                const isStart = this._wpIndex === 0;
                const isEnd = this._wpIndex === pts.length - 1;
                if (isStart) {
                    updates.snapStartId = this._wpSnapTarget?.elementId || null;
                }
                if (isEnd) {
                    updates.snapEndId = this._wpSnapTarget?.elementId || null;
                }

                this.slideManager.updateElement(this._wpFlowlineId, updates);
            }

            // 清除 snap 高亮
            document.querySelectorAll('.flowline-snap-highlight').forEach(h => h.remove());

            this.isDraggingWaypoint = false;
            this._wpHandle = null;
            this._wpFlowlineId = null;
            this._wpIndex = -1;
            this._wpSnapTarget = null;

            // 重新渲染
            // 先儲存ID，因為 renderCurrentSlide 會銷毀 DOM 使 selectedElement 變成 stale ref
            const selectedId = this.editor.selectedElement?.dataset?.id;
            this.slideManager.renderCurrentSlide();
            this.slideManager.renderThumbnails();

            // 重新選取 flowline（使用新的 DOM）
            if (selectedId) {
                this.editor.selectElementById(selectedId);
            }
            return;
        }

        if (this.isDragging && this.activeElement) {
            this.activeElement.style.cursor = 'move';

            // 更新資料
            const id = this.activeElement?.dataset?.id;
            if (!id) { this.isDragging = false; return; }
            this.slideManager.updateElement(id, {
                x: parseInt(this.activeElement.style.left),
                y: parseInt(this.activeElement.style.top)
            });

            // 更新屬性面板
            const propX = document.getElementById('propX');
            const propY = document.getElementById('propY');
            if (propX) propX.value = parseInt(this.activeElement.style.left);
            if (propY) propY.value = parseInt(this.activeElement.style.top);

            // 更新所有拖曳元素的資料
            this._multiDragOffsets.forEach(item => {
                if (item.el !== this.activeElement && item.el?.dataset?.id) {
                    this.slideManager.updateElement(item.el.dataset.id, {
                        x: parseInt(item.el.style.left) || 0,
                        y: parseInt(item.el.style.top) || 0
                    });
                }
            });

            // 更新連接的 flowline
            this.slideManager.updateFlowLineSnaps(id);
            this._altDuplicating = false;
        }

        if (this.isResizing && this.activeElement) {
            const id = this.activeElement?.dataset?.id;
            if (!id) { this.isResizing = false; return; }
            this.slideManager.updateElement(id, {
                x: parseInt(this.activeElement.style.left),
                y: parseInt(this.activeElement.style.top),
                width: this.activeElement.offsetWidth,
                height: this.activeElement.offsetHeight
            });

            // 更新屬性面板
            const propX = document.getElementById('propX');
            const propY = document.getElementById('propY');
            const propW = document.getElementById('propW');
            const propH = document.getElementById('propH');
            if (propX) propX.value = parseInt(this.activeElement.style.left);
            if (propY) propY.value = parseInt(this.activeElement.style.top);
            if (propW) propW.value = this.activeElement.offsetWidth;
            if (propH) propH.value = this.activeElement.offsetHeight;

            // 更新連接的 flowline
            this.slideManager.updateFlowLineSnaps(id);
        }

        this.isDragging = false;
        this.isResizing = false;
        this.activeElement = null;
        this.activeHandle = null;

        // 清除對齊輔助線
        document.querySelectorAll('.snap-guide').forEach(g => g.remove());
    }

    handleDoubleClick(e) {
        const element = e.target.closest('.editable-element');
        if (!element) return;

        const type = element.dataset.type;
        const id = element.dataset.id;

        // 雙擊群組元素 → 進入群組內部編輯
        const slide = this.slideManager.getCurrentSlide();
        if (slide) {
            const elData = slide.elements.find(el => el.id === id);
            if (elData?.groupId && this.editor._editingGroupId !== elData.groupId) {
                this.editor._editingGroupId = elData.groupId;
                this.editor.deselectAll();
                this.editor.selectElement(element);
                return;
            }
        }

        if (type === 'text') {
            // 啟用文字編輯
            element.contentEditable = 'true';
            element.classList.add('editing');
            element.focus();

            // 選取全部文字
            const selection = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(element);
            selection.removeAllRanges();
            selection.addRange(range);

            // 失去焦點時儲存
            const saveContent = () => {
                element.contentEditable = 'false';
                element.classList.remove('editing');

                const id = element.dataset.id;
                this.slideManager.updateElement(id, { content: element.innerHTML });

                element.removeEventListener('blur', saveContent);
            };

            element.addEventListener('blur', saveContent);
        }
    }

    handleKeyDown(e) {
        const isMeta = e.ctrlKey || e.metaKey;
        const active = document.activeElement;
        const isEditing = active && (active.isContentEditable || active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT');

        // Ctrl+A 全選
        if (isMeta && e.key === 'a' && !isEditing) {
            e.preventDefault();
            this.editor.deselectAll();
            const canvas = this.canvasContentEl;
            canvas.querySelectorAll('.slide-element').forEach(el => {
                this.editor.selectedElements.add(el);
                el.classList.add('selected');
            });
            if (this.editor.selectedElements.size > 0) {
                this.editor.selectedElement = [...this.editor.selectedElements][0];
                if (this.editor.selectedElements.size === 1) {
                    this.editor.addResizeHandles(this.editor.selectedElement);
                    this.editor.showPropertyPanel(this.editor.selectedElement);
                } else {
                    this.editor.showMultiSelectPanel();
                }
            }
            return;
        }

        // Ctrl+G 群組
        if (isMeta && e.key === 'g' && !e.shiftKey && !isEditing) {
            e.preventDefault();
            this.editor.groupSelected();
            return;
        }

        // Ctrl+Shift+G 解散群組
        if (isMeta && e.key === 'g' && e.shiftKey && !isEditing) {
            e.preventDefault();
            this.editor.ungroupSelected();
            return;
        }

        // Ctrl+D 快速複製元素（原位偏移）
        if (isMeta && e.key === 'd' && !isEditing && this.editor.selectedElements.size > 0) {
            e.preventDefault();
            const slide = this.slideManager.getCurrentSlide();
            if (!slide) return;
            const newIds = [];
            [...this.editor.selectedElements].forEach(sel => {
                const data = slide.elements.find(d => d.id === sel.dataset.id);
                if (data) {
                    const dup = JSON.parse(JSON.stringify(data));
                    dup.id = this.slideManager.generateId();
                    dup.groupId = null;
                    dup.x += 20;
                    dup.y += 20;
                    slide.elements.push(dup);
                    newIds.push(dup.id);
                }
            });
            this.slideManager.renderCurrentSlide();
            this.slideManager.renderThumbnails();
            this.editor.deselectAll();
            const canvas = this.canvasContentEl;
            newIds.forEach(id => {
                const dom = canvas.querySelector(`[data-id="${id}"]`);
                if (dom) {
                    this.editor.selectedElements.add(dom);
                    dom.classList.add('selected');
                }
            });
            if (this.editor.selectedElements.size > 0) {
                this.editor.selectedElement = [...this.editor.selectedElements][0];
                if (this.editor.selectedElements.size === 1) {
                    this.editor.addResizeHandles(this.editor.selectedElement);
                    this.editor.showPropertyPanel(this.editor.selectedElement);
                } else {
                    this.editor.showMultiSelectPanel();
                }
            }
            return;
        }

        // Ctrl+C 複製元素（有選取時）
        // 必須 preventDefault 避免瀏覽器將 DOM 內容（含圖片）寫入系統剪貼簿，否則 paste 時會重複
        if (isMeta && e.key === 'c' && !e.shiftKey && this.editor.selectedElements.size > 0 && !isEditing) {
            e.preventDefault();
            const slide = this.slideManager.getCurrentSlide();
            if (!slide) return;
            this._copiedElements = [...this.editor.selectedElements].map(sel => {
                const data = slide.elements.find(d => d.id === sel.dataset.id);
                return data ? JSON.parse(JSON.stringify(data)) : null;
            }).filter(Boolean);
            return;
        }

        // Ctrl+V → 不在 keydown 處理，改由 editor.js 的 paste event 統一處理

        // Delete 或 Backspace 刪除選中元素
        if ((e.key === 'Delete' || e.key === 'Backspace') && this.editor.selectedElement) {
            if (!isEditing) {
                e.preventDefault();
                this.editor.deleteSelected();
            }
        }

        // 方向鍵移動元素（多選支援）
        if (this.editor.selectedElement && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            if (!isEditing) {
                e.preventDefault();
                const step = e.shiftKey ? 10 : 1;
                let dx = 0, dy = 0;
                switch (e.key) {
                    case 'ArrowUp': dy = -step; break;
                    case 'ArrowDown': dy = step; break;
                    case 'ArrowLeft': dx = -step; break;
                    case 'ArrowRight': dx = step; break;
                }

                this.editor.selectedElements.forEach(el => {
                    let x = (parseInt(el.style.left) || 0) + dx;
                    let y = (parseInt(el.style.top) || 0) + dy;
                    el.style.left = `${x}px`;
                    el.style.top = `${y}px`;
                    this.slideManager.updateElement(el.dataset.id, { x, y });
                });
            }
        }
    }
}
