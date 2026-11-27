/** Text/table alternative for the AQI trend chart. */
export default function DailySummaryTable({ summary, caption }) {
  return (
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer text-teal-300 underline-offset-2 hover:underline">
        View chart data as a table
      </summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left">
          <caption className="sr-only">{caption}</caption>
          <thead className="text-slate-300">
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Lowest AQI</th>
              <th scope="col">Average AQI</th>
              <th scope="col">Highest AQI</th>
              <th scope="col">Category (avg)</th>
            </tr>
          </thead>
          <tbody>
            {summary.map((day) => (
              <tr key={day.date}>
                <th scope="row" className="font-normal">
                  {day.date}
                  {day.includesForecast ? ' (includes forecast)' : ''}
                </th>
                <td>{day.min}</td>
                <td>{day.avg}</td>
                <td>{day.max}</td>
                <td>{day.category}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
