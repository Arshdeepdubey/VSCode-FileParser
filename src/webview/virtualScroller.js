/**
 * Virtual Scroller Module
 * Efficiently renders large datasets (10K+ rows) by maintaining only visible rows in DOM
 * Uses Intersection Observer for viewport detection and dynamic row range calculation
 * 
 * Architecture:
 * - Maintains two buffers: visible rows + buffer zone (100px top/bottom)
 * - Tracks rowIndex → element mapping for efficient updates
 * - Throttles scroll events to 100ms for performance
 * - Fires 'rowsRequested' event when new rows needed from backend
 * 
 * Usage:
 *   const scroller = new VirtualScroller(tableBody, { rowHeight: 35, bufferSize: 100 });
 *   scroller.setData(allRows);
 *   scroller.render();
 */

class VirtualScroller {
  constructor(containerElement, options = {}) {
    this.container = containerElement;
    this.table = containerElement.closest('table');
    this.window = options.window || global;
    
    // Configuration
    this.rowHeight = options.rowHeight || 35;  // Approximate row height in pixels
    this.bufferSize = options.bufferSize || 100;  // Pixels above/below viewport to pre-render
    this.throttleMs = options.throttleMs || 100;  // Scroll event throttle duration
    
    // State
    this.allRows = [];
    this.visibleRows = new Set();
    this.rowElements = new Map();  // rowIndex -> DOM element
    this.renderedRange = { start: 0, end: 0 };
    this.lastScrollTime = 0;
    this.isScrolling = false;
    this.scrollTimeout = null;
    
    // Cache for row height measurement
    this.measuredRowHeight = null;
    
    // Intersection Observer for viewport detection
    this.intersectionObserver = new (this.window.IntersectionObserver || IntersectionObserver)(
      entries => this.handleIntersection(entries),
      { rootMargin: `${this.bufferSize}px 0px` }
    );
    
    // Scroll listener
    this.scrollListener = this.handleScroll.bind(this);
    this.setupScrollListener();
  }

  /**
   * Set all data rows to virtualize
   */
  setData(rows) {
    this.allRows = rows;
    this.visibleRows.clear();
    this.rowElements.clear();
    this.renderedRange = { start: 0, end: 0 };
  }

  /**
   * Render initial visible rows based on scroll position
   */
  render() {
    if (this.allRows.length === 0) {
      return;
    }

    // Clear container
    this.container.innerHTML = '';
    
    // Measure actual row height if not known
    if (!this.measuredRowHeight) {
      this.measureRowHeight();
    }

    // Calculate initial visible range
    this.updateVisibleRange();
    
    // Render initial set of rows
    this.renderVisibleRows();
  }

  /**
   * Measure actual row height from first rendered row
   */
  measureRowHeight() {
    if (this.container.children.length === 0) return;
    
    const firstRow = this.container.children[0];
    this.measuredRowHeight = firstRow.offsetHeight;
    if (this.measuredRowHeight > 0) {
      this.rowHeight = this.measuredRowHeight;
    }
  }

  /**
   * Calculate which rows should be visible based on scroll position
   */
  updateVisibleRange() {
    const scrollTop = this.getScrollTop();
    const viewportHeight = this.getViewportHeight();
    
    // Calculate buffer zone
    const bufferPixels = this.bufferSize;
    const topBoundary = Math.max(0, scrollTop - bufferPixels);
    const bottomBoundary = scrollTop + viewportHeight + bufferPixels;
    
    // Convert pixel positions to row indices
    const startIndex = Math.floor(topBoundary / this.rowHeight);
    const endIndex = Math.ceil(bottomBoundary / this.rowHeight);
    
    this.renderedRange = {
      start: Math.max(0, startIndex),
      end: Math.min(this.allRows.length, endIndex)
    };
  }

  /**
   * Render only visible rows in the calculated range
   */
  renderVisibleRows() {
    const { start, end } = this.renderedRange;
    
    // Remove rows outside visible range
    this.rowElements.forEach((element, rowIndex) => {
      if (rowIndex < start || rowIndex >= end) {
        this.intersectionObserver.unobserve(element);
        element.remove();
        this.rowElements.delete(rowIndex);
        this.visibleRows.delete(rowIndex);
      }
    });

    // Add spacer rows for efficient scrolling
    // (invisible placeholder rows to maintain scroll position)
    const topSpacerHeight = start * this.rowHeight;
    const bottomSpacerHeight = Math.max(0, (this.allRows.length - end) * this.rowHeight);
    
    // Create top spacer if needed
    if (topSpacerHeight > 0 && !this.topSpacer) {
      this.topSpacer = document.createElement('tr');
      this.topSpacer.style.height = topSpacerHeight + 'px';
      this.container.appendChild(this.topSpacer);
    } else if (this.topSpacer) {
      this.topSpacer.style.height = topSpacerHeight + 'px';
    }

    // Render visible rows
    for (let i = start; i < end; i++) {
      if (!this.rowElements.has(i)) {
        const row = this.allRows[i];
        const tr = this.createRowElement(row, i);
        
        // Append after top spacer
        if (this.topSpacer) {
          this.topSpacer.insertAdjacentElement('afterend', tr);
        } else {
          this.container.appendChild(tr);
        }
        
        this.rowElements.set(i, tr);
        this.visibleRows.add(i);
        
        // Observe row for Intersection Observer
        this.intersectionObserver.observe(tr);
      }
    }

    // Create bottom spacer if needed
    if (bottomSpacerHeight > 0 && !this.bottomSpacer) {
      this.bottomSpacer = document.createElement('tr');
      this.bottomSpacer.style.height = bottomSpacerHeight + 'px';
      this.container.appendChild(this.bottomSpacer);
    } else if (this.bottomSpacer) {
      this.bottomSpacer.style.height = bottomSpacerHeight + 'px';
    }

    // Emit event for backend to fetch additional rows if needed
    this.emitRowsRequested(start, end);
  }

  /**
   * Create a DOM row element from parsed row data
   */
  createRowElement(parsedRow, rowIndex) {
    const tr = document.createElement('tr');
    tr.setAttribute('data-row-index', rowIndex);
    tr.className = rowIndex % 2 === 0 ? 'row-even' : 'row-odd';
    
    // Row number column
    const numTd = document.createElement('td');
    numTd.className = 'row-number';
    numTd.textContent = (rowIndex + 1).toLocaleString();
    tr.appendChild(numTd);
    
    // Data columns from CSV/TXT
    if (parsedRow.data && typeof parsedRow.data === 'object') {
      for (const [key, value] of Object.entries(parsedRow.data)) {
        const td = document.createElement('td');
        td.className = 'row-data';
        td.textContent = this.formatCellValue(value);
        td.title = value;  // Tooltip for truncated content
        tr.appendChild(td);
      }
    }
    
    return tr;
  }

  /**
   * Format cell value for display (truncate long strings)
   */
  formatCellValue(value) {
    if (value === null || value === undefined) {
      return '(empty)';
    }
    
    const str = String(value);
    const maxLength = 50;
    
    if (str.length > maxLength) {
      return str.substring(0, maxLength) + '...';
    }
    
    return str;
  }

  /**
   * Handle Intersection Observer events
   */
  handleIntersection(entries) {
    entries.forEach(entry => {
      const rowIndex = parseInt(entry.target.getAttribute('data-row-index'));
      
      if (entry.isIntersecting) {
        this.visibleRows.add(rowIndex);
      } else {
        this.visibleRows.delete(rowIndex);
      }
    });
  }

  /**
   * Handle scroll events with throttling
   */
  handleScroll() {
    const now = Date.now();
    
    // Throttle scroll events
    if (now - this.lastScrollTime < this.throttleMs) {
      return;
    }
    
    this.lastScrollTime = now;
    
    // Mark as scrolling for styling
    if (!this.isScrolling) {
      this.isScrolling = true;
      this.table.classList.add('scrolling');
    }
    
    // Clear previous timeout
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }
    
    // Update visible range and re-render
    this.updateVisibleRange();
    this.renderVisibleRows();
    
    // Mark as done scrolling after delay
    this.scrollTimeout = setTimeout(() => {
      this.isScrolling = false;
      this.table.classList.remove('scrolling');
    }, 500);
  }

  /**
   * Setup scroll listener on parent container
   */
  setupScrollListener() {
    const scrollContainer = this.findScrollContainer();
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', this.scrollListener, { passive: true });
    }
  }

  /**
   * Find the scrollable parent container
   */
  findScrollContainer() {
    let element = this.table;
    while (element) {
      const style = this.window.getComputedStyle(element);
      if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
        return element;
      }
      element = element.parentElement;
    }
    
    // Fallback to window
    return this.window;
  }

  /**
   * Get current scroll position
   */
  getScrollTop() {
    const scrollContainer = this.findScrollContainer();
    if (scrollContainer === this.window) {
      return this.window.scrollY || this.window.pageYOffset;
    }
    return scrollContainer.scrollTop;
  }

  /**
   * Get viewport height
   */
  getViewportHeight() {
    const scrollContainer = this.findScrollContainer();
    if (scrollContainer === this.window) {
      return this.window.innerHeight;
    }
    return scrollContainer.clientHeight;
  }

  /**
   * Emit custom event for backend row fetch
   */
  emitRowsRequested(startIndex, endIndex) {
    const event = new CustomEvent('rowsRequested', {
      detail: { startIndex, endIndex, totalRows: this.allRows.length }
    });
    this.table.dispatchEvent(event);
  }

  /**
   * Cleanup and remove event listeners
   */
  destroy() {
    this.intersectionObserver.disconnect();
    
    const scrollContainer = this.findScrollContainer();
    if (scrollContainer) {
      scrollContainer.removeEventListener('scroll', this.scrollListener);
    }
    
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }
  }

  /**
   * Force re-render (useful when window resizes)
   */
  refresh() {
    this.measuredRowHeight = null;
    this.render();
  }
}

/**
 * Export for both browser and Node.js environments
 */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VirtualScroller;
}

// Make available globally in webview
if (typeof window !== 'undefined') {
  window.VirtualScroller = VirtualScroller;
}
