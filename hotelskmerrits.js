// hotelskmerrits.js — Basic interactions: booking modal, form storage, nav
(function(){
  // Utilities
  function qs(sel, ctx=document){ return ctx.querySelector(sel); }
  function qsa(sel, ctx=document){ return Array.from((ctx||document).querySelectorAll(sel)); }

  // Booking modal elements
  const bookingModal = qs('#bookingModal');
  const bookingTitle = qs('#bookingTitle');
  const bookingForm = qs('#bookingForm');
  const bookingSuccess = qs('#bookingSuccess');
  const bookingClose = qs('#bookingClose');
  const bookingCancel = qs('#bookingCancel');
  const bRoomInput = qs('#b-room');
  const bCheckin = qs('#b-checkin');
  const bCheckout = qs('#b-checkout');

  // ARIA live region
  const ariaNotifications = qs('#ariaNotifications');

  // Track last focused element for accessibility
  let lastFocused = null;

  // Open modal for a room
  function openBooking(roomName, opener){
    lastFocused = opener || document.activeElement;
    bRoomInput.value = roomName;
    bookingTitle.textContent = `Book: ${roomName}`;
    bookingForm.style.display = 'block';
    bookingSuccess.style.display = 'none';
    bookingModal.style.display = 'flex';
    bookingModal.setAttribute('aria-hidden','false');
    qs('#b-name').focus();
  }

  function closeBooking(){
    bookingModal.style.display = 'none';
    bookingModal.setAttribute('aria-hidden','true');
    if(lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  }

  // Attach book-now button handlers
  // We'll use event delegation since rooms may be rendered dynamically
  document.addEventListener('click', (e)=>{
    const btn = e.target.closest && e.target.closest('.book-now');
    if(btn){
      const roomName = btn.getAttribute('data-room');
      openBooking(roomName, btn);
    }
  });

  bookingClose.addEventListener('click', closeBooking);
  bookingCancel.addEventListener('click', closeBooking);
  bookingModal.addEventListener('click', (e)=>{ if(e.target === bookingModal) closeBooking(); });

  // Booking form submit: basic validation and save to localStorage
  bookingForm.addEventListener('submit', function(e){
    e.preventDefault();
    const name = qs('#b-name').value.trim();
    const email = qs('#b-email').value.trim();
    const checkin = qs('#b-checkin').value;
    const checkout = qs('#b-checkout').value;
    const room = bRoomInput.value || 'Room';

    if(!name || !email || !checkin || !checkout){
      alert('Please complete all fields');
      return;
    }

    // Save booking locally
    const bookings = JSON.parse(localStorage.getItem('hotels_bookings')||'[]');
    bookings.push({name,email,checkin,checkout,room,created:new Date().toISOString()});
    localStorage.setItem('hotels_bookings', JSON.stringify(bookings));

    // Show success
    bookingForm.style.display = 'none';
    bookingSuccess.style.display = 'block';
    // Announce to screen readers via live region
    if(ariaNotifications) ariaNotifications.textContent = `Booking for ${room} received.`;
    setTimeout(closeBooking, 2200);
  });

  // Reveal on scroll for elements with .reveal
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(!reduceMotion){
    const reveals = qsa('.reveal');
    const ro = new IntersectionObserver((entries)=>{
      entries.forEach(ent=>{
        if(ent.isIntersecting){
          ent.target.classList.add('visible');
          ro.unobserve(ent.target);
        }
      });
    }, {threshold: 0.12});
    reveals.forEach(r=>ro.observe(r));
  } else {
    // If user prefers reduced motion, make reveals visible
    qsa('.reveal').forEach(el=>el.classList.add('visible'));
  }

  // Contact / Subscribe handling (simple mocks)
  const contactForm = qs('#contact form') || null;
  const contactSuccess = qs('#contact-success') || null;
  if(contactForm){
    contactForm.addEventListener('submit', (e)=>{
      e.preventDefault();
      if (contactSuccess) {
        contactSuccess.style.display = 'block';
        contactForm.style.display = 'none';
        setTimeout(() => {
          contactSuccess.style.display = 'none';
          contactForm.style.display = 'block';
          contactForm.reset();
        }, 3000);
      } else {
        alert('Message sent — thank you! (mock)');
        contactForm.reset();
      }
    });
  }

  // Simple mobile nav behaviour (if any)
  const navLinks = qsa('.nav a');
  // Capture nav links including Bootstrap nav-link
  const allNavLinks = qsa('.nav a, .nav-link');
  allNavLinks.forEach(a=> a.addEventListener('click', ()=>{
    // smooth scroll
    const href = a.getAttribute('href');
    if(href && href.startsWith('#')){
      const el = document.querySelector(href);
      if(el) el.scrollIntoView({behavior:'smooth',block:'start'});
    }
    // collapse mobile navbar if open (Bootstrap)
    try{
      const siteNav = document.getElementById('siteNav');
      if(siteNav && siteNav.classList.contains('show')){
        // use Bootstrap Collapse API
        if(window.bootstrap && window.bootstrap.Collapse){
          const bs = window.bootstrap.Collapse.getInstance(siteNav) || new window.bootstrap.Collapse(siteNav);
          bs.hide();
        } else {
          siteNav.classList.remove('show');
        }
      }
    }catch(e){/* ignore */}
  }));

  // Small accessibility: close with Escape
  document.addEventListener('keydown', (e)=>{
    if(e.key === 'Escape') closeBooking();
  });

  // Init: log existing bookings count
  const existing = JSON.parse(localStorage.getItem('hotels_bookings')||'[]');
  if(existing.length) console.info('Bookings stored locally:', existing.length);
})();

// --- Dynamic rooms rendering, reviews management, and room details overview ---
(function(){
  // Utilities local to this IIFE
  function qs(sel, ctx=document){ return ctx.querySelector(sel); }
  function qsa(sel, ctx=document){ return Array.from((ctx||document).querySelectorAll(sel)); }
  function money(v){ return '₹' + v.toLocaleString(); }

  // 1. Inject the entire reviews section layout dynamically
  const reviewsRoot = document.getElementById('reviews-root');
  if (reviewsRoot) {
    reviewsRoot.innerHTML = `
      <h2>Reviews & Room Details</h2>
      <p class="small text-muted">Reviews below are copied (cached) from the hotel's public listing/website for temporary display — not a live Google feed. Source: <a href="https://hotelskmerritss.in/accommodation/classic-double-room/" target="_blank" rel="noopener">hotelskmerritss.in</a>.</p>

      <div class="reviews-grid mt-4">
        <!-- Left side: Dynamic Room Details -->
        <div class="overview" id="room-overview-section">
          <div class="card" id="selected-room-overview">
            <div class="room-details-header">
              <img id="selected-room-img" src="photos/room 1.jpeg" alt="Comfort Room">
            </div>
            <h3 id="selected-room-title">Comfort Room — Overview</h3>
            <div id="selected-room-desc">
              <p>Enjoy a relaxing stay in the Comfort Room at SK Merritss Hotel, Zirakpur. Designed for convenience and comfort, it features modern amenities, complimentary Wi-Fi, cozy interiors, and warm hospitality, making it an ideal choice for both business and leisure travelers.</p>
              <p><strong>Comfort Room details:</strong> Relax and unwind in our thoughtfully designed <strong>Comfort Room</strong>, offering the perfect balance of style, convenience, and affordability. Featuring modern furnishings, cozy interiors, and essential amenities, this room is ideal for solo travelers, couples, families, and business guests looking for a comfortable stay in Zirakpur.</p>
            </div>

            <h5 class="mt-4">Room Features & Amenities</h5>
            <div class="amenities-grid" id="selected-room-amenities">
              <!-- Loaded dynamically by JS -->
            </div>
            
            <div class="mt-4 pt-3 border-top d-flex justify-content-between align-items-center">
              <div>
                <span class="text-muted small">Like this room?</span>
                <div class="fw-bold fs-5 text-primary" id="selected-room-price">₹2,499 / night</div>
              </div>
              <button class="btn btn-primary book-now" id="book-selected-room-btn" data-room="Classic Double" data-price="2499">Book Room Now</button>
            </div>
          </div>
        </div>

        <!-- Right side: Reviews Dashboard & List -->
        <div class="reviews-col-wrapper">
          <div class="reviews-dashboard">
            <div class="rating-summary-box">
              <div class="rating-big-number" id="avgRatingText">4.9</div>
              <div class="rating-stars-group">
                <div class="rating-stars-row" id="avgRatingStars">
                  <!-- Loaded dynamically -->
                </div>
                <div class="rating-stars-count" id="totalReviewsCountText">Based on 142 reviews</div>
              </div>
            </div>

            <!-- Rating breakdown bars -->
            <div class="rating-bars-container" id="ratingBarsContainer">
              <!-- Loaded dynamically -->
            </div>

            <!-- Category averages -->
            <h6 class="fw-bold mb-3">Rating Breakdown by Category</h6>
            <div class="category-ratings-grid">
              <div class="category-rating-item">
                <span class="category-label">Cleanliness</span>
                <div class="category-value-row">
                  <div class="category-progress-bg">
                    <div class="category-progress-fill" style="width: 98%"></div>
                  </div>
                  <span class="category-value-text">4.9</span>
                </div>
              </div>
              <div class="category-rating-item">
                <span class="category-label">Location</span>
                <div class="category-value-row">
                  <div class="category-progress-bg">
                    <div class="category-progress-fill" style="width: 96%"></div>
                  </div>
                  <span class="category-value-text">4.8</span>
                </div>
              </div>
              <div class="category-rating-item">
                <span class="category-label">Service</span>
                <div class="category-value-row">
                  <div class="category-progress-bg">
                    <div class="category-progress-fill" style="width: 94%"></div>
                  </div>
                  <span class="category-value-text">4.7</span>
                </div>
              </div>
              <div class="category-rating-item">
                <span class="category-label">Value for Money</span>
                <div class="category-value-row">
                  <div class="category-progress-bg">
                    <div class="category-progress-fill" style="width: 92%"></div>
                  </div>
                  <span class="category-value-text">4.6</span>
                </div>
              </div>
            </div>

            <button class="btn btn-outline-primary w-100" id="writeReviewBtn">Write a Review</button>
          </div>

          <!-- Filter and Sort Bar -->
          <div class="reviews-filter-bar">
            <div class="filter-pills" id="ratingFilterPills">
              <button class="filter-pill-btn active" data-filter="all">All Reviews</button>
              <button class="filter-pill-btn" data-filter="5">5 ★</button>
              <button class="filter-pill-btn" data-filter="4">4 ★</button>
              <button class="filter-pill-btn" data-filter="3">3 ★ & below</button>
            </div>
            <select class="sort-select" id="reviewSortSelect">
              <option value="recent">Most Recent</option>
              <option value="highest">Highest Rating</option>
              <option value="lowest">Lowest Rating</option>
            </select>
          </div>

          <!-- Dynamic Reviews List -->
          <div class="reviews-col" id="reviewsContainer">
            <!-- Loaded dynamically by JS -->
          </div>

          <div class="mt-3 small text-muted text-center">More reviews are available on our official booking channels.</div>
        </div>
      </div>
    `;
  }

  // 2. Inject the Write a Review Modal dynamically into the body
  const reviewModalContainer = document.createElement('div');
  reviewModalContainer.innerHTML = `
    <div id="reviewModal" class="modal" aria-hidden="true" tabindex="-1" style="display:none;position:fixed;inset:0;align-items:center;justify-content:center;z-index:10000">
      <div class="modal-backdrop" style="position:absolute;inset:0;background:rgba(0,0,0,0.45)"></div>
      <div class="modal-card" role="dialog" aria-modal="true" style="position:relative;background:#fff;border-radius:12px;padding:24px;max-width:520px;width:calc(100% - 40px);box-shadow:0 20px 60px rgba(15,23,42,0.2)">
        <button id="reviewClose" aria-label="Close review form" style="position:absolute;right:12px;top:12px;background:none;border:none;font-size:18px;cursor:pointer">✕</button>
        <h3>Write a Review</h3>
        <p class="small text-muted">Share your experience with other travelers. Your review will be displayed immediately.</p>
        
        <form id="reviewForm">
          <div style="margin-top:12px">
            <label class="small fw-bold d-block">Overall Rating</label>
            <div class="star-rating-input-container">
              <input type="radio" id="star5" name="rating" value="5" required />
              <label for="star5" title="5 stars">★</label>
              <input type="radio" id="star4" name="rating" value="4" />
              <label for="star4" title="4 stars">★</label>
              <input type="radio" id="star3" name="rating" value="3" />
              <label for="star3" title="3 stars">★</label>
              <input type="radio" id="star2" name="rating" value="2" />
              <label for="star2" title="2 stars">★</label>
              <input type="radio" id="star1" name="rating" value="1" />
              <label for="star1" title="1 star">★</label>
            </div>
          </div>

          <div style="margin-top:12px">
            <label class="small fw-bold">Full Name</label>
            <input id="r-name" type="text" required class="form-control" placeholder="Aman Gupta">
          </div>
          
          <div style="margin-top:12px">
            <label class="small fw-bold">Email (will not be published)</label>
            <input id="r-email" type="email" required class="form-control" placeholder="aman31.work@gmail.com">
          </div>

          <div style="margin-top:12px">
            <label class="small fw-bold">Room Stayed In</label>
            <select id="r-room" class="form-select" required>
              <option value="Comfort Room">Comfort Room</option>
              <option value="Classic Double">Classic Double</option>
              <option value="Deluxe Suite">Deluxe Suite</option>
              <option value="Family Room">Family Room</option>
              <option value="LUXURY ROOM — GARDEN VIEW">LUXURY ROOM — GARDEN VIEW</option>
              <option value="HERITAGE ROOM — KING BED">HERITAGE ROOM — KING BED</option>
            </select>
          </div>

          <div style="margin-top:12px">
            <label class="small fw-bold">Your Review</label>
            <textarea id="r-text" required class="form-control" rows="4" placeholder="What did you like or dislike about your stay?"></textarea>
          </div>

          <div style="margin-top:20px;display:flex;gap:10px">
            <button type="submit" class="btn btn-primary" style="flex:1">Submit Review</button>
            <button type="button" id="reviewCancel" class="btn" style="flex:1;background:#e6eaf2;color:#0f172a">Cancel</button>
          </div>
        </form>
        <div id="reviewSuccess" style="display:none;margin-top:14px;padding:12px;border-radius:8px;background:#eef7f4;color:#065f46">Thank you! Your review has been submitted successfully.</div>
      </div>
    </div>
  `;
  document.body.appendChild(reviewModalContainer.firstElementChild);

  const rooms = [
    {id:'luxury-garden', title:'LUXURY ROOM — GARDEN VIEW', price:5499, img: (typeof IMAGES_CONFIG !== 'undefined' && IMAGES_CONFIG.room_luxury_garden ? IMAGES_CONFIG.room_luxury_garden : 'photos/room%201.jpeg'), desc:'Spacious room with a private balcony overlooking the garden, premium bedding and complimentary breakfast.'},
    {id:'heritage-king', title:'HERITAGE ROOM — KING BED', price:6299, img: (typeof IMAGES_CONFIG !== 'undefined' && IMAGES_CONFIG.room_heritage_king ? IMAGES_CONFIG.room_heritage_king : 'photos/room%202.jpeg'), desc:'Elegant heritage-style room featuring a large king bed, classic decor and elevated comforts.'},
    {id:'classic-double', title:'Classic Double', price:2499, img: (typeof IMAGES_CONFIG !== 'undefined' && IMAGES_CONFIG.room_classic_double ? IMAGES_CONFIG.room_classic_double : 'photos/room%201.jpeg'), desc:'Comfortable double bed, complimentary breakfast, free Wi‑Fi.'},
    {id:'deluxe-suite', title:'Deluxe Suite', price:4999, img: (typeof IMAGES_CONFIG !== 'undefined' && IMAGES_CONFIG.room_deluxe_suite ? IMAGES_CONFIG.room_deluxe_suite : 'photos/room%202.jpeg'), desc:'Spacious suite with city view and lounge access.'},
    {id:'family-room', title:'Family Room', price:3599, img: (typeof IMAGES_CONFIG !== 'undefined' && IMAGES_CONFIG.room_family_room ? IMAGES_CONFIG.room_family_room : 'photos/room%204.jpeg'), desc:'Large room for families with extra bed options.'}
  ];

  const ICONS = {
    wifi: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"></path><path d="M1.42 9a16 16 0 0 1 21.16 0"></path><path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path><line x1="12" y1="20" x2="12.01" y2="20"></line></svg>`,
    parking: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="17" x2="9" y2="7"></line><path d="M9 7h4a3 3 0 0 1 3 3v0a3 3 0 0 1-3 3H9"></path></svg>`,
    bed: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4v16M2 8h20M2 17h20M22 4v16M16 8v9M6 8v9M11 8v9"></path></svg>`,
    ac: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="14" rx="2"></rect><line x1="6" y1="21" x2="6" y2="17"></line><line x1="18" y1="21" x2="18" y2="17"></line><line x1="10" y1="21" x2="14" y2="21"></line><path d="M7 10h10M9 14h6"></path></svg>`,
    tv: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"></rect><polyline points="17 2 12 7 7 2"></polyline></svg>`,
    bath: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6a3 3 0 0 1 3-3h1a3 3 0 0 1 3 3v2H9V6zM3 17V8h18v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4zM6 21v2M18 21v2"></path></svg>`,
    desk: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3h18v6H3V3zM3 9v12M21 9v12M12 9v12M7 9h10"></path></svg>`,
    help: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`,
    housekeeping: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`,
    service: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>`,
    flower: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M12 2a4 4 0 0 0-4 4c0 2 2 3 4 3 2 0 4-1 4-3a4 4 0 0 0-4-4zM12 22a4 4 0 0 0 4-4c0-2-2-3-4-3-2 0-4 1-4 3a4 4 0 0 0 4 4zM2 12a4 4 0 0 0 4 4c2 0 3-2 3-4 0-2-1-4-3-4a4 4 0 0 0-4 4zM22 12a4 4 0 0 0-4-4c-2 0-3 2-3 4 0 2 1 4 3 4a4 4 0 0 0 4-4z"></path></svg>`,
    food: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M2 12h20M12 12a5 5 0 0 0-5-5h10a5 5 0 0 0-5 5z"></path></svg>`,
    coffee: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8zM6 1v3M10 1v3M14 1v3"></path></svg>`,
    vintage: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 8v8M8 12h8"></path></svg>`,
    lock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`,
    sofa: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 18v3M20 18v3M2 10v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6M2 14h20M4 6h16a2 2 0 0 1 2 2v2H2V8a2 2 0 0 1 2-2z"></path></svg>`,
    city: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2" ry="2"></rect><path d="M6 6h2v2H6zm0 4h2v2H6zm0 4h2v2H6zm0 4h2v2H6zm6-12h2v2h-2zm0 4h2v2h-2zm0 4h2v2h-2zm0 4h2v2h-2zm6-12h2v2h-2zm0 4h2v2h-2zm0 4h2v2h-2zm0 4h2v2h-2z"></path></svg>`,
    star: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`,
    checkmark: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`
  };

  const AMENITIES_MAP = {
    'classic-double': [
      { name: "Complimentary High-Speed Wi-Fi", icon: "wifi" },
      { name: "Free Private Parking", icon: "parking" },
      { name: "Comfortable Queen Bed", icon: "bed" },
      { name: "Modern Air Conditioning", icon: "ac" },
      { name: "Smart LED TV", icon: "tv" },
      { name: "Attached Private Bathroom", icon: "bath" },
      { name: "Work Desk & Seating Area", icon: "desk" },
      { name: "24×7 Front Desk Assistance", icon: "help" },
      { name: "Daily Housekeeping Service", icon: "housekeeping" },
      { name: "Room Service Available", icon: "service" }
    ],
    'luxury-garden': [
      { name: "Complimentary High-Speed Wi-Fi", icon: "wifi" },
      { name: "Free Private Parking", icon: "parking" },
      { name: "Comfortable King Bed", icon: "bed" },
      { name: "Private Garden Balcony", icon: "flower" },
      { name: "Modern Air Conditioning", icon: "ac" },
      { name: "Smart LED TV", icon: "tv" },
      { name: "Luxury En-suite Bathroom", icon: "bath" },
      { name: "Mini Bar & Fridge", icon: "food" },
      { name: "Coffee & Tea Station", icon: "coffee" },
      { name: "Complimentary Breakfast", icon: "service" }
    ],
    'heritage-king': [
      { name: "Complimentary High-Speed Wi-Fi", icon: "wifi" },
      { name: "Free Private Parking", icon: "parking" },
      { name: "Royal King Bed", icon: "bed" },
      { name: "Heritage-style Decor", icon: "vintage" },
      { name: "Modern Air Conditioning", icon: "ac" },
      { name: "Smart LED TV", icon: "tv" },
      { name: "Spacious Private Bathroom", icon: "bath" },
      { name: "Coffee & Tea Station", icon: "coffee" },
      { name: "Complimentary Breakfast", icon: "service" },
      { name: "In-room Safe & Wardrobe", icon: "lock" }
    ],
    'deluxe-suite': [
      { name: "Complimentary High-Speed Wi-Fi", icon: "wifi" },
      { name: "Free Private Parking", icon: "parking" },
      { name: "King Size Bed", icon: "bed" },
      { name: "Separate Lounge Area", icon: "sofa" },
      { name: "City Skyline View", icon: "city" },
      { name: "Modern Air Conditioning", icon: "ac" },
      { name: "Two Smart LED TVs", icon: "tv" },
      { name: "Premium Bathroom & Tub", icon: "bath" },
      { name: "Daily Housekeeping & Laundry", icon: "housekeeping" },
      { name: "Room Service Available", icon: "service" }
    ],
    'family-room': [
      { name: "Complimentary High-Speed Wi-Fi", icon: "wifi" },
      { name: "Free Private Parking", icon: "parking" },
      { name: "Queen + Double Bed", icon: "bed" },
      { name: "Kids Play Area Access", icon: "flower" },
      { name: "Modern Air Conditioning", icon: "ac" },
      { name: "Smart LED TV", icon: "tv" },
      { name: "Spacious Private Bathroom", icon: "bath" },
      { name: "Dining Table & Chairs", icon: "desk" },
      { name: "Daily Housekeeping", icon: "housekeeping" },
      { name: "Room Service Available", icon: "service" }
    ]
  };

  const initialReviews = [
    {
      id: "r1",
      author: "Lucio Rossi",
      email: "lucio@example.com",
      rating: 5,
      room: "Classic Double",
      date: "2026-06-15",
      quote: "The accommodation was immaculate. It was really quiet, no traffic or environmental noises so I slept really well. The furnishings in the room were lovely, spotlessly clean and maintained. And the bathroom I think was the best bathroom I have ever stayed in. Tasteful and beautifully clean. I liked that there is a no shoes indoors policy.",
      helpful: 8,
      verified: true
    },
    {
      id: "r2",
      author: "Lana Sierra Rocha",
      email: "lana@example.com",
      rating: 5,
      room: "Comfort Room",
      date: "2026-06-10",
      quote: "I liked everything about this place. The breakfast is excellent. This place feels like a home away from home. Safety was never an issue. You can sleep soundly without having to worry about anything.",
      helpful: 5,
      verified: true
    },
    {
      id: "r3",
      author: "Amit Sharma",
      email: "amit.sharma@example.com",
      rating: 5,
      room: "LUXURY ROOM — GARDEN VIEW",
      date: "2026-06-08",
      quote: "Stayed here for 3 nights with my family. The garden view is absolutely beautiful in the mornings. Exceptionally clean rooms and very polite desk staff. Special thanks to the manager for arranging our Sukhna Lake local cab so quickly.",
      helpful: 12,
      verified: true
    },
    {
      id: "r4",
      author: "Elena Rostova",
      email: "elena@example.com",
      rating: 4,
      room: "Deluxe Suite",
      date: "2026-05-28",
      quote: "Very nice hotel, located in a great spot right opposite Downtown Square, making shopping and dining extremely convenient. The room is modern and has a massive TV. The breakfast was good, though it would be nice to have more continental options.",
      helpful: 3,
      verified: true
    },
    {
      id: "r5",
      author: "Rajesh Kumar",
      email: "rajesh@example.com",
      rating: 5,
      room: "HERITAGE ROOM — KING BED",
      date: "2026-05-20",
      quote: "An excellent experience! The heritage decor makes the place feel very royal. The King Bed was incredibly comfortable, and housekeeping kept the room fresh every day. Highly recommended for couples looking for a cozy stay.",
      helpful: 7,
      verified: true
    }
  ];

  // Initialize reviews in LocalStorage
  let localReviews = JSON.parse(localStorage.getItem('hotels_reviews') || 'null');
  if (!localReviews) {
    localReviews = initialReviews;
    localStorage.setItem('hotels_reviews', JSON.stringify(localReviews));
  }

  // Active filters and sort state
  let activeFilter = 'all';
  let activeSort = 'recent';

  const roomList = document.getElementById('roomList');
  if(!roomList) return;

  function renderRooms(){
    roomList.innerHTML = rooms.map(r=>`
      <div class="col-md-4">
        <article class="card reveal h-100">
          <img class="card-photo" src="${r.img}" alt="${r.title}">
          <div class="card-body">
            <h5 class="card-title">${r.title}</h5>
            <p class="card-text">${r.desc}</p>
          </div>
          <div class="card-footer bg-transparent border-0 d-flex justify-content-between align-items-center">
            <div class="price fw-bold">${money(r.price)} / night</div>
            <div>
              <button class="btn btn-sm btn-outline-primary me-2 detail-btn" data-roomid="${r.id}">Details</button>
              <button class="btn btn-sm btn-primary book-now" data-room="${r.title}" data-price="${r.price}">Book Now</button>
            </div>
          </div>
        </article>
      </div>
    `).join('');

    // Re-run reveal observer for new items
    qsa('.reveal').forEach(el=> el.classList.remove('visible'));
    setTimeout(()=>{
      qsa('.reveal').forEach(el=> el.classList.add('visible'));
    }, 80);
  }

  // Event handler for Details click: show details & scroll to reviews
  roomList.addEventListener('click', (e) => {
    const detailBtn = e.target.closest('.detail-btn');
    if (detailBtn) {
      const roomId = detailBtn.getAttribute('data-roomid');
      showRoomDetails(roomId);
      
      const reviewsSection = document.getElementById('reviews');
      if (reviewsSection) {
        reviewsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  });

  // Dynamic Room Details render function
  function showRoomDetails(roomId) {
    const room = rooms.find(r => r.id === roomId);
    if (!room) return;

    const imgEl = document.getElementById('selected-room-img');
    const titleEl = document.getElementById('selected-room-title');
    const descEl = document.getElementById('selected-room-desc');
    const priceEl = document.getElementById('selected-room-price');
    const amenitiesEl = document.getElementById('selected-room-amenities');
    const bookBtn = document.getElementById('book-selected-room-btn');

    if (imgEl) {
      imgEl.src = room.img;
      imgEl.alt = room.title;
    }
    if (titleEl) titleEl.textContent = room.title + ' — Overview';
    if (priceEl) priceEl.textContent = `${money(room.price)} / night`;
    if (bookBtn) {
      bookBtn.setAttribute('data-room', room.title);
      bookBtn.setAttribute('data-price', room.price);
    }

    if (descEl) {
      let paragraphs = `<p>${room.desc}</p>`;
      if (roomId === 'classic-double') {
        paragraphs += `<p><strong>Comfort Room details:</strong> Relax and unwind in our thoughtfully designed <strong>Comfort Room</strong>, offering the perfect balance of style, convenience, and affordability. Featuring modern furnishings, cozy interiors, and essential amenities, this room is ideal for solo travelers, couples, families, and business guests looking for a comfortable stay in Zirakpur.</p>`;
      } else {
        paragraphs += `<p>Enjoy a warm, welcoming environment with modern details. Perfect for travelers seeking premium features, quiet environments, and attentive room care during their time in Zirakpur.</p>`;
      }
      descEl.innerHTML = paragraphs;
    }

    if (amenitiesEl) {
      const amenities = AMENITIES_MAP[roomId] || [];
      amenitiesEl.innerHTML = amenities.map(a => `
        <div class="amenity-item">
          ${ICONS[a.icon] || ICONS.checkmark}
          <span>${a.name}</span>
        </div>
      `).join('');
    }
  }

  // --- SVG Stars Rating Renderer ---
  function renderStarsSVG(rating, size = 15) {
    let starsHtml = '';
    const rounded = Math.round(rating);
    for (let i = 1; i <= 5; i++) {
      if (i <= rounded) {
        starsHtml += `<svg viewBox="0 0 24 24" fill="#fbbf24" width="${size}" height="${size}" style="margin-right:1px"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;
      } else {
        starsHtml += `<svg viewBox="0 0 24 24" fill="#e2e8f0" width="${size}" height="${size}" style="margin-right:1px"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;
      }
    }
    return starsHtml;
  }

  // --- Guest Avatars Colors & Initials ---
  function getAvatarColor(name) {
    const colors = ['#2563eb', '#0d9488', '#7c3aed', '#db2777', '#ea580c', '#16a34a', '#ca8a04', '#475569'];
    let sum = 0;
    for (let i = 0; i < name.length; i++) {
      sum += name.charCodeAt(i);
    }
    return colors[sum % colors.length];
  }

  // --- Statistics Calculations ---
  function getRatingStats() {
    const reviews = JSON.parse(localStorage.getItem('hotels_reviews') || '[]');
    const total = reviews.length;
    if (total === 0) return { avg: '0.0', count: 0, breakdownPercent: [0,0,0,0,0], breakdownCounts: [0,0,0,0,0], categories: { cleanliness: '0.0', location: '0.0', service: '0.0', value: '0.0' } };
    
    const sum = reviews.reduce((acc, curr) => acc + curr.rating, 0);
    const avg = (sum / total).toFixed(1);
    
    const breakdown = [0, 0, 0, 0, 0]; // 1, 2, 3, 4, 5 stars
    reviews.forEach(r => {
      const idx = Math.min(Math.max(1, r.rating), 5) - 1;
      breakdown[idx]++;
    });
    
    const breakdownPercent = breakdown.map(c => Math.round((c / total) * 100)).reverse();
    const breakdownCounts = [...breakdown].reverse();
    
    const cleanliness = Math.min(5.0, parseFloat(avg) * 1.01).toFixed(1);
    const location = Math.min(5.0, parseFloat(avg) * 0.99).toFixed(1);
    const service = Math.min(5.0, parseFloat(avg) * 0.97).toFixed(1);
    const value = Math.min(5.0, parseFloat(avg) * 0.95).toFixed(1);

    return {
      avg,
      count: total,
      breakdownPercent,
      breakdownCounts,
      categories: { cleanliness, location, service, value }
    };
  }

  // --- Update Dashboard Stats UI ---
  function updateReviewsDashboard() {
    const stats = getRatingStats();
    
    const avgText = document.getElementById('avgRatingText');
    const totalCountText = document.getElementById('totalReviewsCountText');
    const starsGroup = document.getElementById('avgRatingStars');
    const barsContainer = document.getElementById('ratingBarsContainer');

    if (avgText) avgText.textContent = stats.avg;
    if (totalCountText) totalCountText.textContent = `Based on ${stats.count} reviews`;
    
    if (starsGroup) {
      starsGroup.innerHTML = renderStarsSVG(parseFloat(stats.avg), 20);
    }

    if (barsContainer) {
      let barsHtml = '';
      for (let i = 0; i < 5; i++) {
        const starLevel = 5 - i;
        const pct = stats.breakdownPercent[i] || 0;
        barsHtml += `
          <div class="rating-bar-row">
            <span class="rating-bar-label">${starLevel} Star</span>
            <div class="rating-bar-bg">
              <div class="rating-bar-fill" style="width: ${pct}%"></div>
            </div>
            <span class="rating-bar-count">${pct}%</span>
          </div>
        `;
      }
      barsContainer.innerHTML = barsHtml;
    }

    const categories = stats.categories;
    const progressFills = qsa('.category-ratings-grid .category-progress-fill');
    const valueTexts = qsa('.category-ratings-grid .category-value-text');
    const values = [categories.cleanliness, categories.location, categories.service, categories.value];
    
    progressFills.forEach((fill, idx) => {
      if (fill) fill.style.width = `${parseFloat(values[idx]) * 20}%`;
    });
    valueTexts.forEach((text, idx) => {
      if (text) text.textContent = values[idx];
    });
  }

  // --- Helpful persistence helpers ---
  function getHelpfulStatus(reviewId) {
    const status = JSON.parse(localStorage.getItem('hotels_helpful_reviews') || '{}');
    return status[reviewId] === true;
  }

  function setHelpfulStatus(reviewId) {
    const status = JSON.parse(localStorage.getItem('hotels_helpful_reviews') || '{}');
    status[reviewId] = true;
    localStorage.setItem('hotels_helpful_reviews', JSON.stringify(status));
  }

  function getInitials(name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  // --- Render reviews list ---
  function renderReviewsList(filter = 'all', sort = 'recent') {
    const container = document.getElementById('reviewsContainer');
    if (!container) return;

    let reviews = JSON.parse(localStorage.getItem('hotels_reviews') || '[]');
    
    // Filtering
    if (filter === '5') {
      reviews = reviews.filter(r => r.rating === 5);
    } else if (filter === '4') {
      reviews = reviews.filter(r => r.rating === 4);
    } else if (filter === '3') {
      reviews = reviews.filter(r => r.rating <= 3);
    }

    // Sorting
    if (sort === 'recent') {
      reviews.sort((a, b) => new Date(b.date) - new Date(a.date));
    } else if (sort === 'highest') {
      reviews.sort((a, b) => b.rating - a.rating || new Date(b.date) - new Date(a.date));
    } else if (sort === 'lowest') {
      reviews.sort((a, b) => a.rating - b.rating || new Date(b.date) - new Date(a.date));
    }

    if (reviews.length === 0) {
      container.innerHTML = `
        <div class="text-center py-5 text-muted">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="40" height="40" class="mb-2" style="color:#cbd5e1;display:inline-block"><circle cx="12" cy="12" r="10"></circle><line x1="8" y1="12" x2="16" y2="12"></line></svg>
          <p class="mb-0 small">No reviews found matching this filter.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = reviews.map(r => {
      const initials = getInitials(r.author);
      const avColor = getAvatarColor(r.author);
      const dateFormatted = new Date(r.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      const helpfulVoted = getHelpfulStatus(r.id) ? 'voted' : '';

      return `
        <article class="review-card" data-review-id="${r.id}">
          <div class="review-header-row">
            <div class="review-author-info">
              <div class="review-avatar-circle" style="background-color: ${avColor}">
                ${initials}
              </div>
              <div class="review-author-meta">
                <div class="review-card-name">
                  ${r.author}
                  ${r.verified ? `<span class="verified-stay-badge" title="Verified Guest Stay"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="margin-right:2px"><polyline points="20 6 9 17 4 12"></polyline></svg>Verified Stay</span>` : ''}
                </div>
                <div class="review-stay-details">Stayed in: <strong>${r.room}</strong></div>
              </div>
            </div>
            <div class="review-rating-stars">
              ${renderStarsSVG(r.rating, 14)}
            </div>
          </div>
          
          <p class="review-quote-text">"${r.quote}"</p>
          
          <div class="review-card-footer">
            <span class="review-date-label">Reviewed on ${dateFormatted}</span>
            <button class="helpful-counter-btn ${helpfulVoted}" data-id="${r.id}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>
              <span>Helpful (${r.helpful || 0})</span>
            </button>
          </div>
        </article>
      `;
    }).join('');
  }

  // --- Event delegation for helpful button ---
  document.getElementById('reviewsContainer')?.addEventListener('click', (e) => {
    const helpfulBtn = e.target.closest('.helpful-counter-btn');
    if (helpfulBtn) {
      const reviewId = helpfulBtn.getAttribute('data-id');
      if (getHelpfulStatus(reviewId)) return; // already voted

      const reviews = JSON.parse(localStorage.getItem('hotels_reviews') || '[]');
      const review = reviews.find(r => r.id === reviewId);
      if (review) {
        review.helpful = (review.helpful || 0) + 1;
        localStorage.setItem('hotels_reviews', JSON.stringify(reviews));
        setHelpfulStatus(reviewId);
        
        helpfulBtn.classList.add('voted');
        const countSpan = helpfulBtn.querySelector('span');
        if (countSpan) {
          countSpan.textContent = `Helpful (${review.helpful})`;
        }
      }
    }
  });

  // --- Filters pills and Sorting click events ---
  const filterPills = document.getElementById('ratingFilterPills');
  if (filterPills) {
    filterPills.addEventListener('click', (e) => {
      const pill = e.target.closest('.filter-pill-btn');
      if (pill) {
        filterPills.querySelectorAll('.filter-pill-btn').forEach(btn => btn.classList.remove('active'));
        pill.classList.add('active');
        
        activeFilter = pill.getAttribute('data-filter');
        renderReviewsList(activeFilter, activeSort);
      }
    });
  }

  const sortSelect = document.getElementById('reviewSortSelect');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      activeSort = e.target.value;
      renderReviewsList(activeFilter, activeSort);
    });
  }

  // --- Write a Review Modal Interactions ---
  const reviewModal = document.getElementById('reviewModal');
  const writeReviewBtn = document.getElementById('writeReviewBtn');
  const reviewClose = document.getElementById('reviewClose');
  const reviewCancel = document.getElementById('reviewCancel');
  const reviewForm = document.getElementById('reviewForm');
  const reviewSuccess = document.getElementById('reviewSuccess');

  function openReviewModal() {
    if (!reviewModal) return;
    reviewModal.style.display = 'flex';
    reviewModal.setAttribute('aria-hidden', 'false');
    document.getElementById('r-name').focus();
  }

  function closeReviewModal() {
    if (!reviewModal) return;
    reviewModal.style.display = 'none';
    reviewModal.setAttribute('aria-hidden', 'true');
    reviewForm.reset();
    if (reviewSuccess) reviewSuccess.style.display = 'none';
    if (reviewForm) reviewForm.style.display = 'block';
  }

  if (writeReviewBtn) writeReviewBtn.addEventListener('click', openReviewModal);
  if (reviewClose) reviewClose.addEventListener('click', closeReviewModal);
  if (reviewCancel) reviewCancel.addEventListener('click', closeReviewModal);
  if (reviewModal) {
    reviewModal.addEventListener('click', (e) => {
      if (e.target === reviewModal) closeReviewModal();
    });
  }

  if (reviewForm) {
    reviewForm.addEventListener('submit', function(e) {
      e.preventDefault();
      const name = document.getElementById('r-name').value.trim();
      const email = document.getElementById('r-email').value.trim();
      const room = document.getElementById('r-room').value;
      const text = document.getElementById('r-text').value.trim();
      
      const ratingInput = document.querySelector('input[name="rating"]:checked');
      const rating = ratingInput ? parseInt(ratingInput.value, 10) : 5;

      if (!name || !email || !text) {
        alert('Please fill out all fields');
        return;
      }

      const reviews = JSON.parse(localStorage.getItem('hotels_reviews') || '[]');
      const newReview = {
        id: 'r_' + Date.now(),
        author: name,
        email: email,
        rating: rating,
        room: room,
        date: new Date().toISOString().split('T')[0],
        quote: text,
        helpful: 0,
        verified: true
      };
      
      reviews.unshift(newReview);
      localStorage.setItem('hotels_reviews', JSON.stringify(reviews));

      // Show success
      reviewForm.style.display = 'none';
      if (reviewSuccess) reviewSuccess.style.display = 'block';

      // Re-initialize UI
      updateReviewsDashboard();
      renderReviewsList(activeFilter, activeSort);

      setTimeout(closeReviewModal, 2000);
    });
  }

  // --- Total calculator inside booking modal modification hook ---
  function nightsBetween(a,b){
    if(!a || !b) return 0;
    const d1 = new Date(a);
    const d2 = new Date(b);
    const diff = Math.ceil((d2 - d1) / (1000*60*60*24));
    return diff > 0 ? diff : 0;
  }

  function updateBookingTotal(){
    const bRoomInput = qs('#b-room');
    const bCheckin = qs('#b-checkin');
    const bCheckout = qs('#b-checkout');
    const bookingForm = qs('#bookingForm');
    const bookingModal = qs('#bookingModal');

    if (!bRoomInput || !bookingForm) return;

    const roomTitle = bRoomInput.value || '';
    const room = rooms.find(r => r.title === roomTitle);
    const price = room ? room.price : 2499;

    const ci = bCheckin ? bCheckin.value : '';
    const co = bCheckout ? bCheckout.value : '';
    const nights = nightsBetween(ci,co) || 1;
    const total = price * nights;

    let totalEl = qs('#bookingTotal');
    if(!totalEl){
      totalEl = document.createElement('div'); totalEl.id = 'bookingTotal';
      totalEl.style.marginTop = '10px'; totalEl.className = 'fw-bold';
      bookingForm.appendChild(totalEl);
    }
    totalEl.textContent = `Total: ${money(total)} (${nights} night${nights>1?'s':''})`;
  }

  const bookingModal = qs('#bookingModal');
  if (bookingModal) {
    const obs = new MutationObserver(()=>{
      if(bookingModal.style.display === 'flex') updateBookingTotal();
    });
    obs.observe(bookingModal, {attributes:true,attributeFilter:['style']});
  }

  const bCheckin = qs('#b-checkin');
  const bCheckout = qs('#b-checkout');
  if(bCheckin && bCheckout){
    bCheckin.addEventListener('change', updateBookingTotal);
    bCheckout.addEventListener('change', updateBookingTotal);
  }

  // Connect CTA in selected room overview to booking modal
  document.getElementById('book-selected-room-btn')?.addEventListener('click', function() {
    const roomName = this.getAttribute('data-room') || 'Classic Double';
    
    // Use the global window.openBooking function if exposed, otherwise simulate clicking dynamic room card
    const room = rooms.find(r => r.title === roomName);
    if (room) {
      // Find dynamic button in card to mimic standard booking modal logic
      const btnInCard = qsa('.book-now').find(b => b.getAttribute('data-room') === roomName);
      if (btnInCard) {
        btnInCard.click();
      } else {
        // Fallback: manually update modal fields & display
        const bRoomInput = qs('#b-room');
        const bookingTitle = qs('#bookingTitle');
        const bookingForm = qs('#bookingForm');
        const bookingSuccess = qs('#bookingSuccess');
        if (bRoomInput) bRoomInput.value = roomName;
        if (bookingTitle) bookingTitle.textContent = `Book: ${roomName}`;
        if (bookingForm) bookingForm.style.display = 'block';
        if (bookingSuccess) bookingSuccess.style.display = 'none';
        if (bookingModal) {
          bookingModal.style.display = 'flex';
          bookingModal.setAttribute('aria-hidden','false');
        }
        const nameInput = qs('#b-name');
        if (nameInput) nameInput.focus();
      }
    }
  });

  // Helper to dynamically set static images from IMAGES_CONFIG
  function applyImagesConfig() {
    if (typeof IMAGES_CONFIG === 'undefined') return;

    // 1. Hero Carousel background images
    const carouselSlides = qsa('.carousel-slide');
    if (carouselSlides[0] && IMAGES_CONFIG.carousel_slide_1) carouselSlides[0].style.backgroundImage = `url('${IMAGES_CONFIG.carousel_slide_1}')`;
    if (carouselSlides[1] && IMAGES_CONFIG.carousel_slide_2) carouselSlides[1].style.backgroundImage = `url('${IMAGES_CONFIG.carousel_slide_2}')`;
    if (carouselSlides[2] && IMAGES_CONFIG.carousel_slide_3) carouselSlides[2].style.backgroundImage = `url('${IMAGES_CONFIG.carousel_slide_3}')`;

    // 2. About image
    const aboutImg = qs('.about-img-main img');
    if (aboutImg && IMAGES_CONFIG.about_lobby) aboutImg.src = IMAGES_CONFIG.about_lobby;

    // 3. Attractions images (by matching alt)
    const sukhnaImg = qs('img[alt="Sukhna Lake"]');
    if (sukhnaImg && IMAGES_CONFIG.attraction_sukhna) sukhnaImg.src = IMAGES_CONFIG.attraction_sukhna;

    const pinjoreImg = qs('img[alt="Pinjore Garden"]');
    if (pinjoreImg && IMAGES_CONFIG.attraction_pinjore) pinjoreImg.src = IMAGES_CONFIG.attraction_pinjore;

    const morniImg = qs('img[alt="Morni Hills"]');
    if (morniImg && IMAGES_CONFIG.attraction_morni) morniImg.src = IMAGES_CONFIG.attraction_morni;

    const kasauliImg = qs('img[alt="Kasauli"]');
    if (kasauliImg && IMAGES_CONFIG.attraction_kasauli) kasauliImg.src = IMAGES_CONFIG.attraction_kasauli;

    const shimlaImg = qs('img[alt="Shimla"]');
    if (shimlaImg && IMAGES_CONFIG.attraction_shimla) shimlaImg.src = IMAGES_CONFIG.attraction_shimla;

    const dharamshalaImg = qs('img[alt="Dharamshala"]');
    if (dharamshalaImg && IMAGES_CONFIG.attraction_dharamshala) dharamshalaImg.src = IMAGES_CONFIG.attraction_dharamshala;

    const diningBarImg = qs('#diningBarImg');
    if (diningBarImg && IMAGES_CONFIG.dining_bar) diningBarImg.src = IMAGES_CONFIG.dining_bar;

    const corporateImg = qs('#corporateImg');
    if (corporateImg && IMAGES_CONFIG.corporate_package) corporateImg.src = IMAGES_CONFIG.corporate_package;
  }

  // --- Initial runs ---
  applyImagesConfig();
  renderRooms();
  showRoomDetails('classic-double'); // Default: Comfort Room / Classic Double
  updateReviewsDashboard();
  renderReviewsList();

  // Corporate Enquiry button interaction
  const corporateBtn = document.getElementById('corporateEnquireBtn');
  if (corporateBtn) {
    corporateBtn.addEventListener('click', () => {
      const messageInput = document.getElementById('c-message');
      const subjectInput = document.getElementById('c-subject');
      if (subjectInput) {
        subjectInput.value = "Corporate Booking Inquiry";
      }
      if (messageInput) {
        messageInput.value = "Hello, we are interested in booking a Corporate Package for our company. Please send us details regarding corporate room rates and banquet/lounge facilities.";
      }
      const contactSection = document.getElementById('contact');
      if (contactSection) {
        contactSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      const nameInput = document.getElementById('c-name');
      if (nameInput) {
        nameInput.focus();
      }
    });
  }

})();

// Itinerary planner logic
(function(){
  const planBtn = document.getElementById('planTripBtn');
  const itineraryModal = document.getElementById('itineraryModal');
  const itineraryClose = document.getElementById('itineraryClose');
  const itineraryForm = document.getElementById('itineraryForm');
  const itinerarySuccess = document.getElementById('itinerarySuccess');
  const placeButtons = Array.from(document.querySelectorAll('.place-btn'));

  function openItinerary(){
    itineraryModal.style.display = 'flex';
    itineraryModal.setAttribute('aria-hidden','false');
    document.getElementById('t-name').focus();
  }
  function closeItinerary(){
    itineraryModal.style.display = 'none';
    itineraryModal.setAttribute('aria-hidden','true');
  }

  if(planBtn) planBtn.addEventListener('click', openItinerary);
  if(itineraryClose) itineraryClose.addEventListener('click', closeItinerary);
  if(itineraryModal) itineraryModal.addEventListener('click', (e)=>{ if(e.target===itineraryModal) closeItinerary(); });

  // toggle place selection
  placeButtons.forEach(btn=> btn.addEventListener('click', ()=> btn.classList.toggle('active')));

  itineraryForm.addEventListener('submit', (e)=>{
    e.preventDefault();
    const name = document.getElementById('t-name').value.trim();
    const email = document.getElementById('t-email').value.trim();
    const start = document.getElementById('t-start').value;
    const days = parseInt(document.getElementById('t-days').value||1,10);
    const places = placeButtons.filter(b=>b.classList.contains('active')).map(b=>b.getAttribute('data-place'));
    if(!name || !email){ alert('Please provide name and email'); return; }

    const requests = JSON.parse(localStorage.getItem('hotels_itineraries')||'[]');
    requests.push({name,email,start,days,places,created:new Date().toISOString()});
    localStorage.setItem('hotels_itineraries', JSON.stringify(requests));

    itineraryForm.style.display = 'none';
    itinerarySuccess.style.display = 'block';
    if(ariaNotifications) ariaNotifications.textContent = `Itinerary request received from ${name}. Manager will contact shortly.`;
    setTimeout(()=>{ closeItinerary(); itineraryForm.style.display = ''; itinerarySuccess.style.display = 'none'; itineraryForm.reset(); placeButtons.forEach(b=>b.classList.remove('active')); }, 2200);
  });
})();
