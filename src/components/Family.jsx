import { useState } from 'react';
import { Printer, Trash2 } from 'lucide-react';
import { MAX_PROFILE_NAME_LENGTH } from '../constants.js';
import { ADVICE, adviceTier } from '../lib/aqi.js';
import { DataBadge, PageTitle, UnknownAqiNote } from './common.jsx';

const GUIDANCE = {
  child: ADVICE.child,
  elderly: ADVICE.elderly,
  worker: ADVICE.worker,
  adult: ADVICE.general,
};
export const LABELS = {
  child: 'Child',
  elderly: 'Elderly',
  worker: 'Outdoor worker',
  adult: 'Adult',
};

/** Family page: household profiles and a printable, audience-specific safety report. */
export default function Family({ airQuality, family }) {
  const { members, addMember, removeMember, cloudEnabled } = family;
  const [name, setName] = useState('');
  const [type, setType] = useState('child');
  const [message, setMessage] = useState('');
  const tier = adviceTier(airQuality.current.aqi);

  return (
    <div className="space-y-4">
      <PageTitle>Family safety</PageTitle>
      {airQuality.current.aqi == null && <UnknownAqiNote />}
      <form
        className="card noprint flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const n = name.trim();
          if (!n) {
            setMessage('Please enter a name.');
            return;
          }
          addMember(n, type);
          setMessage(`Added ${n}.`);
          setName('');
        }}
      >
        <div>
          <label htmlFor="member-name" className="mb-1 block text-sm text-slate-300">
            Family member name
          </label>
          <input
            id="member-name"
            className="inp"
            maxLength={MAX_PROFILE_NAME_LENGTH}
            autoComplete="off"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-describedby="member-help"
          />
        </div>
        <div>
          <label htmlFor="member-type" className="mb-1 block text-sm text-slate-300">
            Category
          </label>
          <select
            id="member-type"
            className="inp"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            {Object.entries(LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <button className="btn">Add member</button>
        <p id="member-help" className="w-full text-xs text-slate-300">
          {cloudEnabled
            ? 'Profiles sync to your cloud profile (Supabase).'
            : 'Profiles are saved on this device only.'}
        </p>
      </form>
      <p role="status" className="sr-only">
        {message}
      </p>
      <section className="card">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">
            Pollution Safety Report — {airQuality.place.name} (AQI{' '}
            {airQuality.current.aqi ?? 'unavailable'}, {airQuality.current.category})
          </h2>
          <button className="btn noprint" aria-label="Print report" onClick={() => window.print()}>
            <Printer aria-hidden="true" size={16} />
          </button>
        </div>
        <p className="text-xs text-slate-300">
          {new Date(airQuality.fetchedAt).toLocaleString()} · <DataBadge demo={airQuality.demo} />
        </p>
        {members.length === 0 ? (
          <p className="mt-3 text-sm">Add members to generate tailored guidance.</p>
        ) : (
          <ul>
            {members.map((member) => (
              <li
                key={member.id}
                className="mt-3 flex items-start justify-between gap-2 border-t border-white/10 pt-2"
              >
                <div>
                  <b>{member.name}</b>{' '}
                  <span className="text-xs text-teal-300">{LABELS[member.type]}</span>
                  <p className="text-sm">{GUIDANCE[member.type]?.[tier]}</p>
                </div>
                <button
                  aria-label={`Remove ${member.name}`}
                  className="noprint rounded p-2 text-slate-300 hover:text-red-400"
                  onClick={() => {
                    removeMember(member.id);
                    setMessage(`Removed ${member.name}.`);
                  }}
                >
                  <Trash2 aria-hidden="true" size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <h3 className="mt-4 font-semibold text-teal-300">Community tips</h3>
        <ul className="list-disc pl-5 text-sm">
          <li>Don&apos;t burn waste or leaves; report open burning to local authorities.</li>
          <li>Carpool or use public transport; avoid idling engines.</li>
          <li>Check in on elderly neighbours and outdoor workers on high-AQI days.</li>
        </ul>
        <p className="mt-3 text-xs text-slate-300">General information, not medical advice.</p>
      </section>
    </div>
  );
}
