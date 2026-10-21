/* Tailwind v3 equivalent, for projects on v3. The platform is on v4: use typography-tailwind.css. */
module.exports = {
  theme: {
    extend: {
      fontFamily: {
        heading: ['Manrope', 'Noto Sans', 'Mukta', 'sans-serif'],
        body: ['Inter', 'Noto Sans', 'Mukta', 'sans-serif'],
      },
      fontSize: {
        display: ['40px', { lineHeight: '1.15', fontWeight: '700' }],
        h1: ['28px', { lineHeight: '1.2', fontWeight: '700' }],
        h2: ['22px', { lineHeight: '1.3', fontWeight: '600' }],
        h3: ['18px', { lineHeight: '1.35', fontWeight: '600' }],
        body: ['16px', { lineHeight: '1.6', fontWeight: '400' }],
        small: ['14px', { lineHeight: '1.5', fontWeight: '400' }],
        label: ['12px', { lineHeight: '1.4', fontWeight: '500' }],
        kpi: ['20px', { lineHeight: '1.3', fontWeight: '700' }],
        table: ['14px', { lineHeight: '1.4', fontWeight: '500' }],
        donut: ['18px', { lineHeight: '1.2', fontWeight: '600' }],
      },
    },
  },
};
