import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { getISTTimestampISO } from './timezone.ts';

let dbInstance: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (dbInstance) return dbInstance;

  const dataDir = path.resolve(process.cwd(), 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = path.join(dataDir, 'grace_physio.db');

  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA busy_timeout = 5000;');

  initializeSchema(db);
  seedInitialData(db);

  dbInstance = db;
  return db;
}

function initializeSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('super_admin', 'staff')),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS clinic_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      business_name TEXT NOT NULL,
      tagline TEXT NOT NULL,
      address TEXT NOT NULL,
      phone TEXT NOT NULL,
      whatsapp_number TEXT NOT NULL,
      email TEXT NOT NULL,
      timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
      slot_buffer_minutes INTEGER NOT NULL DEFAULT 10,
      max_concurrent_per_slot INTEGER NOT NULL DEFAULT 1,
      hours_confirmation_note TEXT NOT NULL,
      about_overview TEXT NOT NULL,
      mission TEXT NOT NULL,
      vision TEXT NOT NULL,
      philosophy TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS working_hours (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day_of_week INTEGER NOT NULL UNIQUE CHECK (day_of_week BETWEEN 0 AND 6),
      day_name TEXT NOT NULL,
      is_open INTEGER NOT NULL DEFAULT 1,
      morning_start TEXT NOT NULL,
      morning_end TEXT NOT NULL,
      evening_start TEXT NOT NULL,
      evening_end TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS blocked_dates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      blocked_date TEXT NOT NULL UNIQUE,
      reason TEXT NOT NULL,
      block_type TEXT NOT NULL DEFAULT 'holiday' CHECK (block_type IN ('holiday', 'closure')),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      short_description TEXT NOT NULL,
      description TEXT NOT NULL,
      benefits_json TEXT NOT NULL,
      suitable_for_json TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL DEFAULT 30,
      image_url TEXT NOT NULL,
      icon_name TEXT NOT NULL DEFAULT 'Activity',
      is_active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS patients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_patients_phone ON patients(phone);

    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reference_code TEXT NOT NULL UNIQUE,
      patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
      service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
      appointment_date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
      notes TEXT NOT NULL DEFAULT '',
      admin_notes TEXT NOT NULL DEFAULT '',
      supabase_synced INTEGER NOT NULL DEFAULT 0,
      supabase_sync_error TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_appointments_date_status ON appointments(appointment_date, status);
    CREATE INDEX IF NOT EXISTS idx_appointments_service ON appointments(service_id);

    CREATE TABLE IF NOT EXISTS appointment_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      appointment_id INTEGER NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
      action TEXT NOT NULL,
      previous_status TEXT,
      new_status TEXT,
      details TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS testimonials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_name TEXT NOT NULL,
      condition_tag TEXT NOT NULL,
      quote TEXT NOT NULL,
      visit_context TEXT NOT NULL,
      is_published INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS gallery_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      caption TEXT NOT NULL,
      category TEXT NOT NULL,
      image_url TEXT NOT NULL,
      is_illustrative INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS team_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      role_title TEXT NOT NULL,
      bio TEXT NOT NULL,
      focus_areas TEXT NOT NULL,
      photo_url TEXT NOT NULL,
      is_published INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS contact_inquiries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL DEFAULT '',
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      created_at TEXT NOT NULL
    );
  `);

  const appointmentCols = db
    .prepare('PRAGMA table_info(appointments)')
    .all() as Array<{ name: string }>;
  const colNames = new Set(appointmentCols.map((c) => c.name));
  if (!colNames.has('supabase_synced')) {
    db.exec('ALTER TABLE appointments ADD COLUMN supabase_synced INTEGER NOT NULL DEFAULT 0;');
  }
  if (!colNames.has('supabase_sync_error')) {
    db.exec("ALTER TABLE appointments ADD COLUMN supabase_sync_error TEXT NOT NULL DEFAULT '';");
  }
}

function seedInitialData(db: DatabaseSync): void {
  const now = getISTTimestampISO();

  const settingsCount = db
    .prepare('SELECT COUNT(*) as count FROM clinic_settings')
    .get() as { count: number };

  if (settingsCount.count === 0) {
    db.prepare(
      `INSERT INTO clinic_settings (
        id, business_name, tagline, address, phone, whatsapp_number, email,
        timezone, slot_buffer_minutes, max_concurrent_per_slot,
        hours_confirmation_note, about_overview, mission, vision, philosophy,
        latitude, longitude, updated_at
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      'Grace Physiotherapy Clinic',
      'Personalized Physiotherapy & Guided Rehabilitation in JP Nagar',
      '2, 15th Main, 17th D Cross Road, 5th Phase, Nanjundeswara Layout, JP Nagar, Bengaluru, Karnataka 560078, India',
      '+91 95913 71199',
      '919591371199',
      'appointments@gracephysiotherapy.in',
      'Asia/Kolkata',
      10,
      1,
      'Listed clinic hours are Monday to Saturday (10:00 AM – 1:00 PM & 5:00 PM – 8:00 PM), Sunday closed. Editable in Admin Dashboard.',
      'Grace Physiotherapy Clinic serves residents across JP Nagar 5th Phase, Nanjundeswara Layout, and South Bengaluru with attentive, one-to-one physiotherapy assessments and structured rehabilitation programs. Every care plan begins with listening carefully to how pain or stiffness affects your daily routine—at work, at home, or during sport—before designing a paced, evidence-informed path forward.',
      'To deliver calm, individualized physiotherapy and movement education that helps every patient understand their body, move with greater confidence, and sustain progress beyond the clinic.',
      'To be a trusted neighbourhood physiotherapy practice in JP Nagar known for unhurried clinical care, clear communication, and steady functional recovery.',
      'We focus on root-cause biomechanical assessment rather than rushed symptom checklists. Combining hands-on manual therapy, electrotherapy modalities when clinically appropriate, and progressive home exercise guidance, we partner with patients throughout every stage of rehabilitation.',
      12.9012,
      77.5892,
      now
    );
  }

  const hoursCount = db
    .prepare('SELECT COUNT(*) as count FROM working_hours')
    .get() as { count: number };

  if (hoursCount.count === 0) {
    const days = [
      { day: 0, name: 'Sunday', open: 0, ms: '10:00', me: '13:00', es: '17:00', ee: '20:00' },
      { day: 1, name: 'Monday', open: 1, ms: '10:00', me: '13:00', es: '17:00', ee: '20:00' },
      { day: 2, name: 'Tuesday', open: 1, ms: '10:00', me: '13:00', es: '17:00', ee: '20:00' },
      { day: 3, name: 'Wednesday', open: 1, ms: '10:00', me: '13:00', es: '17:00', ee: '20:00' },
      { day: 4, name: 'Thursday', open: 1, ms: '10:00', me: '13:00', es: '17:00', ee: '20:00' },
      { day: 5, name: 'Friday', open: 1, ms: '10:00', me: '13:00', es: '17:00', ee: '20:00' },
      { day: 6, name: 'Saturday', open: 1, ms: '10:00', me: '13:00', es: '17:00', ee: '20:00' },
    ];
    const stmt = db.prepare(
      `INSERT INTO working_hours (day_of_week, day_name, is_open, morning_start, morning_end, evening_start, evening_end)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    for (const d of days) {
      stmt.run(d.day, d.name, d.open, d.ms, d.me, d.es, d.ee);
    }
  }

  const servicesCount = db
    .prepare('SELECT COUNT(*) as count FROM services')
    .get() as { count: number };

  if (servicesCount.count === 0) {
    const seedServices = [
      {
        slug: 'neck-and-shoulder-pain',
        name: 'Neck and Shoulder Pain',
        category: 'Spine & Posture',
        short_description:
          'Targeted assessment and gentle mobilization for cervical stiffness, desk-related strain, and upper-back tension.',
        description:
          'Prolonged screen posture, repetitive upper-limb tasks, and acute muscle guarding frequently overload the cervical spine and shoulder girdle. Sessions combine joint assessment, soft-tissue release, and practical posture ergonomics tailored to your daily schedule.',
        benefits: [
          'Supports comfortable neck rotation and overhead reach',
          'Addresses muscular tightness across the upper trapezius and scapula',
          'Includes practical desk setup and daily stretch guidance',
        ],
        suitable_for: [
          'Desk professionals experiencing persistent neck stiffness',
          'Radiating upper-back or shoulder blade tension',
          'Postural discomfort after long commutes',
        ],
        duration_minutes: 35,
        image_url: '/src/assets/images/service_spine_manual_1795584347255.jpg',
        icon_name: 'HeartHandshake',
        sort_order: 1,
      },
      {
        slug: 'back-pain-and-spine-rehabilitation',
        name: 'Back Pain and Spine Rehabilitation',
        category: 'Spine & Posture',
        short_description:
          'Structured lumbar and thoracic care focused on core stability, safe movement mechanics, and gradual load tolerance.',
        description:
          'Back discomfort can interrupt sleep, walking, and work. Rather than passive rest alone, our spine rehabilitation program pairs careful directional assessment with graded core strengthening and hip-mobility work to help you move comfortably.',
        benefits: [
          'Builds deep trunk and spinal support through paced exercise',
          'Teaches safer bending, lifting, and sitting habits',
          'Targets stiffness in lumbar segments and surrounding musculature',
        ],
        suitable_for: [
          'Recurrent lower-back stiffness or mechanical ache',
          'Mid-back tightness and prolonged sitting fatigue',
          'Patients seeking guided core conditioning after acute flare-ups',
        ],
        duration_minutes: 40,
        image_url: '/src/assets/images/service_spine_manual_1795584347255.jpg',
        icon_name: 'Activity',
        sort_order: 2,
      },
      {
        slug: 'frozen-shoulder-rehabilitation',
        name: 'Frozen Shoulder Rehabilitation',
        category: 'Joint Rehabilitation',
        short_description:
          'Progressive joint capsule mobilization and pain-paced range-of-motion exercises for adhesive capsulitis.',
        description:
          'Shoulder stiffness that limits dressing, reaching, or sleeping on the affected side requires patient, stage-appropriate care. We calibrate manual mobilization and gentle pendulum-to-active stretches to respect tissue sensitivity at every stage.',
        benefits: [
          'Gradually encourages comfortable external rotation and elevation',
          'Balances soothing modality support with safe active movement',
          'Provides clear home-exercise progressions between clinic visits',
        ],
        suitable_for: [
          'Restricted shoulder elevation or behind-the-back reach',
          'Painful night-time shoulder stiffness',
          'Gradual recovery following shoulder immobilization',
        ],
        duration_minutes: 40,
        image_url: '/src/assets/images/hero_physio_session_1795584344580.jpg',
        icon_name: 'Move',
        sort_order: 3,
      },
      {
        slug: 'knee-and-joint-pain',
        name: 'Knee and Joint Pain',
        category: 'Joint Rehabilitation',
        short_description:
          'Strengthening and biomechanical alignment programs for knee osteoarthritis, stair discomfort, and joint overload.',
        description:
          'Joint comfort depends heavily on how load travels through the hip, knee, and ankle. We evaluate gait, muscle balance, and joint tracking before guiding you through low-impact strengthening that supports daily walking and stair climbing.',
        benefits: [
          'Supports quadriceps, hip abductor, and calf endurance',
          'Helps ease strain during stairs, squatting, and daily walks',
          'Educates on pacing activity and joint-friendly movement patterns',
        ],
        suitable_for: [
          'Age-related knee stiffness or morning joint tightness',
          'Runners or walkers with anterior knee discomfort',
          'Individuals seeking non-invasive strength conditioning',
        ],
        duration_minutes: 35,
        image_url: '/src/assets/images/service_rehab_gym_1795584347521.jpg',
        icon_name: 'ShieldCheck',
        sort_order: 4,
      },
      {
        slug: 'sports-injury-rehabilitation',
        name: 'Sports Injury Rehabilitation',
        category: 'Active & Sports Care',
        short_description:
          'Goal-oriented recovery for sprains, muscle strains, and overuse injuries with structured return-to-activity milestones.',
        description:
          'Whether you enjoy weekend badminton, running in JP Nagar parks, or competitive athletics, returning too quickly invites reinjury. Our sessions progress systematically from tissue calm-down to strength, agility, and sport-specific readiness.',
        benefits: [
          'Restores joint stability, power, and movement confidence',
          'Identifies underlying strength asymmetries that contribute to strain',
          'Tracks clear readiness milestones before full sport resumption',
        ],
        suitable_for: [
          'Ankle sprains, hamstring or calf strains',
          'Tennis elbow, rotator cuff overload, or runner’s knee',
          'Recreational and competitive athletes rebuilding conditioning',
        ],
        duration_minutes: 45,
        image_url: '/src/assets/images/service_rehab_gym_1795584347521.jpg',
        icon_name: 'Sparkles',
        sort_order: 5,
      },
      {
        slug: 'post-surgical-rehabilitation',
        name: 'Post-Surgical Rehabilitation',
        category: 'Surgical Recovery',
        short_description:
          'Protocol-aligned physiotherapy following orthopaedic procedures to rebuild mobility, strength, and everyday independence.',
        description:
          'Recovery after joint replacement, ligament reconstruction, or fracture fixation relies on coordinated, surgeon-aligned physiotherapy. We monitor swelling, protect healing tissues, and guide progressive weight-bearing and functional exercises.',
        benefits: [
          'Follows your orthopaedic surgeon’s phased recovery guidelines',
          'Supports safe range-of-motion restoration and gait retraining',
          'Builds confidence with daily transfers, stairs, and walking',
        ],
        suitable_for: [
          'Total knee or hip replacement rehabilitation',
          'ACL reconstruction and arthroscopic knee procedures',
          'Post-fracture stiffness and rotator cuff repair recovery',
        ],
        duration_minutes: 45,
        image_url: '/src/assets/images/service_rehab_gym_1795584347521.jpg',
        icon_name: 'ClipboardCheck',
        sort_order: 6,
      },
      {
        slug: 'balance-and-mobility-rehabilitation',
        name: 'Balance and Mobility Rehabilitation',
        category: 'Mobility & Seniors',
        short_description:
          'Supervised gait training, coordination drills, and functional strength care for steadier, more confident movement.',
        description:
          'Steadiness on your feet shapes everyday independence. Designed especially for older adults and individuals recovering from prolonged rest, this program trains ankle-hip balance strategies, walking symmetry, and safe sit-to-stand mechanics.',
        benefits: [
          'Supports safer walking indoors and on uneven outdoor surfaces',
          'Strengthens lower-limb muscles essential for standing and stairs',
          'Reduces fear of movement through calm, supervised practice',
        ],
        suitable_for: [
          'Older adults experiencing unsteadiness or slowed walking',
          'Deconditioning after hospital stays or illness',
          'Individuals needing guided balance and coordination practice',
        ],
        duration_minutes: 35,
        image_url: '/src/assets/images/service_rehab_gym_1795584347521.jpg',
        icon_name: 'Footprints',
        sort_order: 7,
      },
      {
        slug: 'ultrasound-therapy',
        name: 'Ultrasound Therapy',
        category: 'Electrotherapy Modalities',
        short_description:
          'Targeted therapeutic acoustic waves used alongside manual care to support soft-tissue comfort and local circulation.',
        description:
          'Therapeutic ultrasound applies gentle, localized high-frequency sound waves over tendons, ligaments, or muscle attachments. Used selectively alongside active physiotherapy, it helps prepare stiff tissues for stretching and movement.',
        benefits: [
          'Delivers focused micro-mechanical stimulation to localized soft tissue',
          'Non-invasive, comfortable session typically paired with exercise',
          'Helpful adjunct for superficial tendon and ligament irritation',
        ],
        suitable_for: [
          'Localized tendon discomfort such as elbow or heel strain',
          'Soft-tissue tightness prior to manual mobilization',
          'Patients whose care plan includes targeted modality support',
        ],
        duration_minutes: 25,
        image_url: '/src/assets/images/service_therapy_modality_1795584347477.jpg',
        icon_name: 'Waves',
        sort_order: 8,
      },
      {
        slug: 'tens-therapy',
        name: 'TENS Therapy',
        category: 'Electrotherapy Modalities',
        short_description:
          'Transcutaneous Electrical Nerve Stimulation calibrated for gentle, non-invasive comfort during acute or persistent pain.',
        description:
          'TENS uses mild, surface-level electrical pulses adjusted to your comfort level to help calm sensory pain signalling and ease muscle guarding, making it easier to participate in guided stretching and strengthening.',
        benefits: [
          'Gentle, drug-free sensory comfort tailored to patient tolerance',
          'Helps ease protective muscle spasm around sore joints',
          'Integrates smoothly with active rehabilitation exercises',
        ],
        suitable_for: [
          'Acute neck, back, or joint soreness limiting movement',
          'Nerve-related tingling or localized musculoskeletal ache',
          'Supportive symptom management alongside rehab exercises',
        ],
        duration_minutes: 25,
        image_url: '/src/assets/images/service_therapy_modality_1795584347477.jpg',
        icon_name: 'Zap',
        sort_order: 9,
      },
      {
        slug: 'laser-therapy',
        name: 'Laser Therapy',
        category: 'Electrotherapy Modalities',
        short_description:
          'Low-level therapeutic photobiomodulation applied to superficial joints and soft tissues as part of a comprehensive plan.',
        description:
          'Therapeutic laser delivers calibrated light wavelengths over targeted musculoskeletal areas in a brief, painless session. We use it thoughtfully as an adjunct to manual therapy and progressive loading exercises.',
        benefits: [
          'Non-thermal, comfortable application over sensitive joints',
          'Short treatment window easily combined with exercise sessions',
          'Supports localized tissue comfort in superficial structures',
        ],
        suitable_for: [
          'Small-joint stiffness in hands, wrists, or ankles',
          'Superficial tendon or plantar fascia irritation',
          'Patients sensitive to deep pressure during early recovery',
        ],
        duration_minutes: 25,
        image_url: '/src/assets/images/service_therapy_modality_1795584347477.jpg',
        icon_name: 'SunMedium',
        sort_order: 10,
      },
      {
        slug: 'therapeutic-exercises',
        name: 'Therapeutic Exercises',
        category: 'Active & Sports Care',
        short_description:
          'One-to-one guided strength, flexibility, and motor-control training designed for long-term resilience.',
        description:
          'Lasting improvement comes from how you move every day. Our therapeutic exercise sessions teach exact form, breathing, and progression using bodyweight, resistance bands, and balance tools—giving you a clear routine you can continue safely at home.',
        benefits: [
          'Builds durable muscular control around vulnerable joints',
          'Ensures correct exercise form with real-time physiotherapist feedback',
          'Provides a sustainable home routine adapted to your schedule',
        ],
        suitable_for: [
          'Anyone transitioning from pain relief to long-term strength',
          'Postural endurance for long workdays',
          'Preventive conditioning to reduce recurring musculoskeletal strain',
        ],
        duration_minutes: 35,
        image_url: '/src/assets/images/service_rehab_gym_1795584347521.jpg',
        icon_name: 'Dumbbell',
        sort_order: 11,
      },
    ];

    const insertService = db.prepare(
      `INSERT INTO services (
        slug, name, category, short_description, description,
        benefits_json, suitable_for_json, duration_minutes, image_url,
        icon_name, is_active, sort_order, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`
    );

    for (const s of seedServices) {
      insertService.run(
        s.slug,
        s.name,
        s.category,
        s.short_description,
        s.description,
        JSON.stringify(s.benefits),
        JSON.stringify(s.suitable_for),
        s.duration_minutes,
        s.image_url,
        s.icon_name,
        s.sort_order,
        now,
        now
      );
    }
  }

  const testimonialsCount = db
    .prepare('SELECT COUNT(*) as count FROM testimonials')
    .get() as { count: number };

  if (testimonialsCount.count === 0) {
    const seedTestimonials = [
      {
        patient_name: 'Raghavendra Kulkarni',
        condition_tag: 'Lower Back Rehabilitation',
        quote:
          'After months of morning back stiffness from long commutes, the clinic took time to explain why my hip and core habits mattered. Following the guided exercise progression helped me return to comfortable daily walks.',
        visit_context: 'JP Nagar 5th Phase Resident · 6-week rehabilitation plan',
      },
      {
        patient_name: 'Meenakshi Sundaram',
        condition_tag: 'Frozen Shoulder Care',
        quote:
          'Every session felt calm and unhurried. Instead of pushing through sharp pain, my physiotherapist adjusted the stretches each week and gave clear home drills so I could regain overhead reach steadily.',
        visit_context: 'Nanjundeswara Layout · Shoulder mobility program',
      },
      {
        patient_name: 'Karthik Narayanan',
        condition_tag: 'Knee & Running Rehab',
        quote:
          'Clean facility, punctual evening slots, and clear explanations at every step. Learning proper knee alignment and strengthening kept me consistent with my recovery routine.',
        visit_context: 'JP Nagar · Evening physiotherapy sessions',
      },
    ];
    const stmt = db.prepare(
      `INSERT INTO testimonials (patient_name, condition_tag, quote, visit_context, is_published, created_at)
       VALUES (?, ?, ?, ?, 1, ?)`
    );
    for (const t of seedTestimonials) {
      stmt.run(t.patient_name, t.condition_tag, t.quote, t.visit_context, now);
    }
  }

  const galleryCount = db
    .prepare('SELECT COUNT(*) as count FROM gallery_images')
    .get() as { count: number };

  if (galleryCount.count === 0) {
    const seedGallery = [
      {
        title: 'Guided Shoulder & Mobility Suite',
        caption:
          'Natural daylight treatment area equipped for one-to-one range-of-motion assessments and manual therapy.',
        category: 'Treatment Rooms',
        image_url: '/src/assets/images/hero_physio_session_1795584344580.jpg',
        sort_order: 1,
      },
      {
        title: 'Reception & Quiet Waiting Lounge',
        caption:
          'Calm, accessible ground-floor reception designed for comfortable arrival before your session.',
        category: 'Clinic Spaces',
        image_url: '/src/assets/images/about_clinic_interior_1795584345353.jpg',
        sort_order: 2,
      },
      {
        title: 'Manual Spine & Cervical Care',
        caption:
          'Dedicated treatment tables for hands-on spinal mobilization, posture assessment, and soft-tissue work.',
        category: 'Treatment Rooms',
        image_url: '/src/assets/images/service_spine_manual_1795584347255.jpg',
        sort_order: 3,
      },
      {
        title: 'Active Rehabilitation Studio',
        caption:
          'Open exercise bay with resistance bands, balance trainers, and stability mats for supervised movement.',
        category: 'Rehab Studio',
        image_url: '/src/assets/images/service_rehab_gym_1795584347521.jpg',
        sort_order: 4,
      },
      {
        title: 'Electrotherapy & Modality Station',
        caption:
          'Calibrated ultrasound, TENS, and therapeutic laser equipment maintained to clinical hygiene standards.',
        category: 'Equipment',
        image_url: '/src/assets/images/service_therapy_modality_1795584347477.jpg',
        sort_order: 5,
      },
      {
        title: 'Private Assessment & Consultation Room',
        caption:
          'Quiet space for initial biomechanical history review and personalized home-exercise planning.',
        category: 'Clinic Spaces',
        image_url: '/src/assets/images/gallery_consultation_room_1795584347342.jpg',
        sort_order: 6,
      },
    ];
    const stmt = db.prepare(
      `INSERT INTO gallery_images (title, caption, category, image_url, is_illustrative, sort_order, created_at)
       VALUES (?, ?, ?, ?, 1, ?, ?)`
    );
    for (const g of seedGallery) {
      stmt.run(g.title, g.caption, g.category, g.image_url, g.sort_order, now);
    }
  }

  const teamCount = db
    .prepare('SELECT COUNT(*) as count FROM team_members')
    .get() as { count: number };

  if (teamCount.count === 0) {
    const seedTeam = [
      {
        name: 'Clinical Physiotherapy Lead',
        role_title: 'Lead Physiotherapist · Profile Editable by Clinic Admin',
        bio: 'Oversees initial movement assessments, individualized spine and joint care planning, and patient education. Verified practitioner name and qualifications can be updated directly from the Admin Dashboard.',
        focus_areas: 'Spine Care · Shoulder Rehabilitation · Manual Therapy',
        photo_url: '/src/assets/images/service_spine_manual_1795584347255.jpg',
        sort_order: 1,
      },
      {
        name: 'Rehabilitation & Exercise Specialist',
        role_title: 'Rehabilitation Physiotherapist · Profile Editable by Clinic Admin',
        bio: 'Guides progressive therapeutic exercise, post-surgical mobility milestones, and balance training. Clinic management can update staff details and verified credentials anytime.',
        focus_areas: 'Knee Rehabilitation · Sports Recovery · Balance Training',
        photo_url: '/src/assets/images/service_rehab_gym_1795584347521.jpg',
        sort_order: 2,
      },
    ];
    const stmt = db.prepare(
      `INSERT INTO team_members (name, role_title, bio, focus_areas, photo_url, is_published, sort_order)
       VALUES (?, ?, ?, ?, ?, 1, ?)`
    );
    for (const m of seedTeam) {
      stmt.run(m.name, m.role_title, m.bio, m.focus_areas, m.photo_url, m.sort_order);
    }
  }
}
