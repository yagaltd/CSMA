/**
 * CSMA Carousel Component
 * Production-ready system with swipe, autoplay, lazy loading, thumbnails, lightbox and variant support.
 */

const MQ_TABLET = window.matchMedia('(min-width: 768px)');
const MQ_DESKTOP = window.matchMedia('(min-width: 1024px)');

export function initCarouselSystem(eventBus) {
  const carousels = document.querySelectorAll('[data-carousel]');
  if (!carousels.length) return () => {};

  const lazyObserver = createLazyObserver();
  const cleanups = [];

  carousels.forEach((root, index) => {
    if (!root.id) root.id = `carousel-${index + 1}`;
    cleanups.push(setupCarousel(root, eventBus, lazyObserver));
  });

  return () => {
    cleanups.forEach((fn) => fn());
    lazyObserver.disconnect();
  };
}

function setupCarousel(root, eventBus, lazyObserver) {
  const viewport = root.querySelector('[data-carousel-viewport]') || root.querySelector('.carousel-viewport');
  const track = root.querySelector('[data-carousel-track]');
  const slides = Array.from(root.querySelectorAll('[data-carousel-slide]'));
  const prevBtn = root.querySelector('[data-carousel-prev]');
  const nextBtn = root.querySelector('[data-carousel-next]');
  const dotsHost = root.querySelector('[data-carousel-dots]');
  const thumbs = Array.from(root.querySelectorAll('[data-carousel-thumb]'));
  const progressBar = root.querySelector('[data-carousel-progress] .carousel-progress__bar');
  const toggleBtn = root.querySelector('[data-carousel-toggle]');
  const metaNode = root.querySelector('[data-carousel-meta]');
  const thumbnailsStrip = root.querySelector('[data-carousel-thumbnails]');

  if (!viewport || !track || !slides.length) return () => {};

  slides.forEach((slide, idx) => {
    if (!slide.id) slide.id = `${root.id}-slide-${idx + 1}`;
    slide.tabIndex = -1;
    bindMediaLoad(slide);
  });

  const config = {
    loop: root.dataset.loop === 'true',
    transition: root.dataset.transition || 'slide',
    autoplay: Number(root.dataset.autoplay || 0),
    pauseOnHover: root.dataset.pauseOnHover !== 'false',
    swipe: root.dataset.swipe !== 'false',
    center: root.dataset.center === 'true'
  };
  const variant = root.dataset.variant || '';

  const state = {
    current: clampIndex(Number(root.dataset.initialIndex || 0), 1),
    dragging: false,
    dragStartX: 0,
    dragStartOffset: 0,
    pointerId: null,
    offsets: [],
    autoplayTimer: null,
    pauses: new Set()
  };

  const listeners = [];

  hydrateLazyNodes(slides, lazyObserver);
  computeOffsets();
  update({ instant: true, recalc: true });
  startAutoplay();

  attach(prevBtn, 'click', () => goTo(state.current - getVisibleCount()));
  attach(nextBtn, 'click', () => goTo(state.current + getVisibleCount()));
  attach(root, 'keydown', handleKeydown);
  attach(document, 'visibilitychange', handleVisibility);
  attach(window, 'resize', handleResize);
  attach(MQ_TABLET, 'change', handleResize);
  attach(MQ_DESKTOP, 'change', handleResize);

  if (config.pauseOnHover) {
    attach(root, 'mouseenter', () => requestPause('hover'));
    attach(root, 'mouseleave', () => releasePause('hover'));
  }

  attach(root, 'focusin', () => requestPause('focus'));
  attach(root, 'focusout', () => releasePause('focus'));

  if (config.swipe && config.transition !== 'fade') {
    attach(viewport, 'pointerdown', handlePointerDown);
    attach(viewport, 'pointermove', handlePointerMove);
    attach(viewport, 'pointerup', handlePointerUp);
    attach(viewport, 'pointercancel', handlePointerUp);
  }

  if (toggleBtn) {
    attach(toggleBtn, 'click', () => {
      if (state.pauses.has('manual')) {
        releasePause('manual');
        toggleBtn.dataset.state = 'playing';
      } else {
        requestPause('manual');
        toggleBtn.dataset.state = 'paused';
      }
    });
  }

  thumbs.forEach((thumb, idx) => {
    if (!thumb.dataset.carouselThumb) {
      thumb.dataset.carouselThumb = String(idx);
    }
    const targetSlide = slides[idx];
    if (targetSlide) {
      thumb.setAttribute('aria-controls', targetSlide.id);
    }
    attach(thumb, 'click', () => {
      const index = Number(thumb.dataset.carouselThumb || idx);
      goTo(index);
      const focusSlide = slides[index];
      if (focusSlide) focusSlide.focus({ preventScroll: true });
    });
  });

  const zoomables = root.querySelectorAll('[data-carousel-zoom]');
  zoomables.forEach((node) => {
    attach(node, 'click', () => openLightbox(node.dataset.zoomSrc || node.getAttribute('src'), node.getAttribute('alt')));
  });

  function attach(target, event, handler, options) {
    if (!target || !target.addEventListener) return false;
    target.addEventListener(event, handler, options);
    listeners.push(() => target.removeEventListener(event, handler, options));
    return true;
  }

  function goTo(target, opts = {}) {
    const visible = getVisibleCount();
    let nextIndex = target;
    if (config.loop) {
      nextIndex = (target + slides.length) % slides.length;
    }
    nextIndex = clampIndex(nextIndex, visible);
    if (nextIndex === state.current) return;
    state.current = nextIndex;
    update(opts);
  }

  function update(options = {}) {
    const visible = getVisibleCount();
    root.style.setProperty('--carousel-visible', visible);

    if (!state.offsets.length || options.recalc) {
      computeOffsets();
    }

    state.current = clampIndex(state.current, visible);
    const offset = config.transition === 'fade' ? 0 : (state.offsets[state.current] || 0);
    root.style.setProperty('--carousel-track-offset', `${offset}px`);

    if (options.instant || config.transition === 'fade') {
      track.style.transition = 'none';
    } else {
      track.style.transition = '';
    }

    slides.forEach((slide, idx) => {
      const isActive = config.transition === 'fade'
        ? idx === state.current
        : idx >= state.current && idx < state.current + visible;
      slide.dataset.state = isActive ? 'active' : 'inactive';
      slide.setAttribute('aria-hidden', isActive ? 'false' : 'true');
    });

    updateDots(visible);
    updateThumbs();
    updateMeta(visible);
    updateViewportHeight(visible);
    manageVideos();
    prepareLazy(visible);
    animateProgress();
    publishChange(visible);
  }

  function updateDots(visible) {
    if (!dotsHost) return;
    const groups = Math.max(1, Math.ceil(slides.length / visible));
    if (dotsHost.childElementCount !== groups) {
      dotsHost.innerHTML = '';
      for (let i = 0; i < groups; i++) {
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'carousel-dot';
        dot.dataset.carouselDot = String(i);
        dot.setAttribute('aria-label', `Go to slide group ${i + 1}`);
        dot.addEventListener('click', () => {
          const start = i * visible;
          goTo(start);
        });
        dotsHost.appendChild(dot);
      }
    }

    dotsHost.querySelectorAll('.carousel-dot').forEach((dot, idx) => {
      const startIdx = Math.min(idx * visible, Math.max(0, slides.length - visible));
      dot.setAttribute('aria-current', startIdx === state.current ? 'true' : 'false');
    });
  }

  function updateThumbs() {
    thumbs.forEach((thumb) => {
      const idx = Number(thumb.dataset.carouselThumb || 0);
      thumb.setAttribute('aria-current', idx === state.current ? 'true' : 'false');
    });

    if (thumbnailsStrip) {
      const activeThumb = thumbnailsStrip.querySelector('[aria-current="true"]');
      if (activeThumb && typeof activeThumb.scrollIntoView === 'function') {
        activeThumb.scrollIntoView({ inline: 'center', behavior: 'smooth', block: 'nearest' });
      }
    }
  }

  function updateMeta(visible) {
    if (!metaNode) return;
    const start = state.current + 1;
    const end = Math.min(slides.length, state.current + visible);
    metaNode.textContent = `Showing ${start}–${end} of ${slides.length}`;
  }

  function updateViewportHeight(visible) {
    if (config.transition === 'fade') return;

    const activeSlides = slides.slice(state.current, state.current + visible);
    let targetHeight = Math.max(...activeSlides.map((slide) => slide.offsetHeight), 0);

    if (variant === 'image') {
      const media = activeSlides[0]?.querySelector('.carousel-slide__media img, [data-slot="media"] img');
      if (media) {
        const rect = media.getBoundingClientRect();
        if (rect.height) targetHeight = rect.height;
      }
    }

    if (variant === 'product') {
      const card = activeSlides[0];
      if (card) targetHeight = Math.max(card.scrollHeight, targetHeight);
    }

    if (variant === 'hero') {
      viewport.style.minHeight = 'clamp(420px, 60vh, 720px)';
      viewport.style.height = `${Math.max(targetHeight, 420)}px`;
      return;
    }

    if (targetHeight <= 1) {
      viewport.style.removeProperty('height');
      viewport.style.removeProperty('min-height');
      return;
    }

    viewport.style.height = `${targetHeight}px`;
    viewport.style.minHeight = `${targetHeight}px`;
  }

  function prepareLazy(visible) {
    const rangeStart = Math.max(0, state.current - 1);
    const rangeEnd = Math.min(slides.length, state.current + visible + 2);
    for (let i = rangeStart; i < rangeEnd; i++) {
      hydrateSlide(slides[i]);
    }
  }

  function animateProgress() {
    if (!progressBar || !config.autoplay) return;
    progressBar.style.transition = 'none';
    progressBar.style.width = '0%';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        progressBar.style.transition = `width ${config.autoplay}ms linear`;
        progressBar.style.width = '100%';
      });
    });
  }

  function manageVideos() {
    slides.forEach((slide, idx) => {
      slide.querySelectorAll('video').forEach((video) => {
        if (idx === state.current) {
          if (video.dataset.autoplay !== 'false') {
            video.muted = true;
            video.play().catch(() => {});
          }
        } else {
          video.pause();
        }
      });
    });
  }

  function startAutoplay() {
    if (!config.autoplay || config.autoplay < 2000) return;
    if (state.pauses.size) return;
    clearInterval(state.autoplayTimer);
    animateProgress();
    state.autoplayTimer = setInterval(() => {
      goTo(state.current + getVisibleCount());
    }, config.autoplay);
  }

  function stopAutoplay() {
    clearInterval(state.autoplayTimer);
    state.autoplayTimer = null;
    if (progressBar) {
      progressBar.style.transition = 'none';
      progressBar.style.width = '0%';
    }
  }

  function requestPause(reason) {
    if (!config.autoplay) return;
    state.pauses.add(reason);
    stopAutoplay();
  }

  function releasePause(reason) {
    state.pauses.delete(reason);
    if (!state.pauses.size) {
      startAutoplay();
    }
  }

  function handleVisibility() {
    if (document.hidden) {
      requestPause('visibility');
    } else {
      releasePause('visibility');
    }
  }

  function handleKeydown(event) {
    const step = getVisibleCount();
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      goTo(state.current + step);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      goTo(state.current - step);
    } else if (event.key === 'Home') {
      event.preventDefault();
      goTo(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      goTo(slides.length - step);
    } else if (event.key === 'Escape') {
      requestPause('manual');
      if (toggleBtn) toggleBtn.dataset.state = 'paused';
    }
  }

  function handleResize() {
    computeOffsets();
    update({ instant: true, recalc: true });
  }

  function handlePointerDown(event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    state.dragging = true;
    state.pointerId = event.pointerId;
    viewport.setPointerCapture(event.pointerId);
    state.dragStartX = event.clientX;
    state.dragStartOffset = state.offsets[state.current] || 0;
    root.dataset.dragging = 'true';
    requestPause('drag');
  }

  function handlePointerMove(event) {
    if (!state.dragging || event.pointerId !== state.pointerId) return;
    const delta = event.clientX - state.dragStartX;
    const maxOffset = state.offsets[state.offsets.length - 1] || 0;
    const nextOffset = clamp(0, maxOffset, state.dragStartOffset - delta);
    root.style.setProperty('--carousel-track-offset', `${nextOffset}px`);
  }

  function handlePointerUp(event) {
    if (!state.dragging || event.pointerId !== state.pointerId) return;
    viewport.releasePointerCapture(event.pointerId);
    state.dragging = false;
    delete root.dataset.dragging;
    const delta = event.clientX - state.dragStartX;
    const threshold = 50;
    if (Math.abs(delta) > threshold) {
      goTo(state.current + (delta < 0 ? getVisibleCount() : -getVisibleCount()));
    } else {
      update();
    }
    releasePause('drag');
  }

  function computeOffsets() {
    state.offsets = slides.map((slide) => {
      return slide.offsetLeft - (slides[0]?.offsetLeft || 0);
    });
  }

  function getVisibleCount() {
    const desktop = Number(root.dataset.visibleLg || root.dataset.visibleDesktop);
    const tablet = Number(root.dataset.visibleMd || root.dataset.visibleTablet);
    const base = Number(root.dataset.visible || 1);
    if (MQ_DESKTOP.matches && desktop) return desktop;
    if (MQ_TABLET.matches && tablet) return tablet;
    return Math.max(1, base);
  }

  function publishChange(visible) {
    if (!eventBus) return;
    try {
      eventBus.publish('CAROUSEL_SLIDE_CHANGED', {
        carouselId: root.id,
        index: state.current,
        total: slides.length,
        visible,
        timestamp: Date.now()
      });
    } catch (err) {
      /* no-op to keep console clean */
    }
  }

  function hydrateSlide(slide) {
    if (!slide) return;
    slide.querySelectorAll('[data-carousel-lazy]').forEach((node) => hydrateMedia(node));
    bindMediaLoad(slide);
  }

  function hydrateLazyNodes(allSlides, observer) {
    allSlides.forEach((slide) => {
      slide.querySelectorAll('[data-carousel-lazy]').forEach((node) => observer.observe(node));
    });
  }

  function bindMediaLoad(slide) {
    if (!slide) return;
    const refresh = () => requestAnimationFrame(() => updateViewportHeight(getVisibleCount()));
    slide.querySelectorAll('img, video').forEach((node) => {
      if (node.tagName === 'IMG') {
        if (node.complete) {
          refresh();
        } else {
          node.addEventListener('load', refresh, { once: true });
        }
      } else if (node.tagName === 'VIDEO') {
        if (node.readyState >= 2) {
          refresh();
        } else {
          node.addEventListener('loadeddata', refresh, { once: true });
        }
      }
    });
  }

  function clamp(min, max, value) {
    return Math.max(min, Math.min(max, value));
  }

  function clampIndex(index, visible) {
    const max = Math.max(0, slides.length - visible);
    return Math.max(0, Math.min(index, max));
  }

  return () => {
    stopAutoplay();
    listeners.forEach((off) => off());
  };
}

function createLazyObserver() {
  return new IntersectionObserver((entries, obs) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        hydrateMedia(entry.target);
        obs.unobserve(entry.target);
      }
    });
  }, { rootMargin: '300px' });
}

function hydrateMedia(node) {
  if (!node || node.dataset.loaded === 'true') return;
  const src = node.dataset.src;
  const srcset = node.dataset.srcset;
  const poster = node.dataset.poster;
  if (src) node.setAttribute('src', src);
  if (srcset) node.setAttribute('srcset', srcset);
  if (poster) node.setAttribute('poster', poster);
  node.loading = node.getAttribute('loading') || 'lazy';
  node.dataset.loaded = 'true';
}

function openLightbox(src, alt) {
  if (!src) return;
  let lightbox = document.querySelector('[data-carousel-lightbox-root]');
  if (!lightbox) {
    lightbox = document.createElement('div');
    lightbox.className = 'carousel-lightbox';
    lightbox.dataset.carouselLightboxRoot = '';
    lightbox.innerHTML = `
      <button type="button" aria-label="Close">✕</button>
      <img alt="">`;
    document.body.appendChild(lightbox);
    const close = lightbox.querySelector('button');
    close.addEventListener('click', () => closeLightbox(lightbox));
    lightbox.addEventListener('click', (evt) => {
      if (evt.target === lightbox) closeLightbox(lightbox);
    });
    document.addEventListener('keydown', (evt) => {
      if (evt.key === 'Escape' && lightbox.dataset.open === 'true') {
        closeLightbox(lightbox);
      }
    });
  }
  const img = lightbox.querySelector('img');
  img.src = src;
  img.alt = alt || '';
  lightbox.dataset.open = 'true';
}

function closeLightbox(lightbox) {
  lightbox.dataset.open = 'false';
}
