import { PageTitle } from './common.jsx';

export default function About() {
  return (
    <section className="card space-y-2 text-sm">
      <PageTitle className="text-lg font-semibold">About AeroSage AI</PageTitle>
      <p>
        AeroSage AI turns air-quality data into practical daily decisions. Air data: Open-Meteo
        (CAMS model). AI: Google Gemini. AQI follows India&apos;s CPCB breakpoints, approximated
        from PM2.5/PM10 only (NO₂, SO₂, O₃ and CO are shown but not included in the AQI).
      </p>
      <p>
        <b>Limits:</b> Model data can differ from nearby ground monitors; always check official
        CPCB/SAFAR/state sources for regulatory readings. AI suggestions are general information,
        not medical advice, and AeroSage AI is not a diagnostic tool. If you have symptoms, speak to
        a qualified medical professional.
      </p>
      <p>
        <b>Accessibility:</b> AeroSage AI is built for keyboard and screen-reader use. Charts have
        text and table alternatives.
      </p>
    </section>
  );
}
