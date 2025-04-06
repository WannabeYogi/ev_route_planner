'use client';

import Footer from '../components/Footer';
import Navbar from '../components/Navbar';

export default function Learn() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />

      <main className="flex-grow mt-16">
        {/* Hero Section */}
        <div className="bg-blue-50 py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              Everything You Should Know About EV Charging
            </h1>
            <p className="text-xl text-gray-600">
              A comprehensive guide for those considering buying their first electric car.
            </p>
          </div>
        </div>

        {/* Content Sections */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          {/* Future of EVs Section */}
          <section className="mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">Future of Electric Vehicles</h2>
            <div className="prose max-w-none">
              <p className="text-lg text-gray-600 mb-8">
                Electric mobility and the popularity of electric passenger vehicles has been growing rapidly over the last decade and this trend doesn't show any signs of slowing down.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                <div className="bg-blue-50 p-6 rounded-lg text-center">
                  <div className="text-3xl font-bold text-blue-600 mb-2">26M</div>
                  <div className="text-gray-600">EVs in 2022</div>
                </div>
                <div className="bg-blue-50 p-6 rounded-lg text-center">
                  <div className="text-3xl font-bold text-blue-600 mb-2">350M</div>
                  <div className="text-gray-600">EVs in 2030</div>
                </div>
                <div className="bg-blue-50 p-6 rounded-lg text-center">
                  <div className="text-3xl font-bold text-blue-600 mb-2">60%</div>
                  <div className="text-gray-600">Total EV share in 2030</div>
                </div>
              </div>
            </div>
          </section>

          {/* Charging Locations */}
          <section className="mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">Where to Charge an Electric Car</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-white p-6 rounded-lg shadow-lg">
                <div className="text-4xl mb-4">🏠</div>
                <h3 className="text-xl font-semibold mb-2">Home Charging</h3>
                <p className="text-gray-600">64% of EV drivers charge at home, waking up to a fully charged vehicle every day.</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-lg">
                <div className="text-4xl mb-4">💼</div>
                <h3 className="text-xl font-semibold mb-2">Workplace Charging</h3>
                <p className="text-gray-600">34% of EV drivers charge at work, making it the second most popular charging location.</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-lg">
                <div className="text-4xl mb-4">🏪</div>
                <h3 className="text-xl font-semibold mb-2">Public Charging</h3>
                <p className="text-gray-600">31% of EV drivers use public charging stations regularly, with numbers growing.</p>
              </div>
            </div>
          </section>

          {/* Battery Life Section */}
          <section className="mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">Battery Life and Range</h2>
            <div className="bg-gray-50 p-8 rounded-lg">
              <h3 className="text-xl font-semibold mb-4">How Long Do EV Batteries Last?</h3>
              <p className="text-gray-600 mb-6">
                Modern EV batteries are designed to last 15-20 years or 100,000 to 200,000 miles. Most manufacturers provide 8-10 years warranty on their batteries.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h4 className="font-semibold mb-2">Factors Affecting Battery Life:</h4>
                  <ul className="list-disc pl-5 space-y-2 text-gray-600">
                    <li>Charging habits</li>
                    <li>Temperature conditions</li>
                    <li>Usage patterns</li>
                    <li>Battery maintenance</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Tips to Maximize Battery Life:</h4>
                  <ul className="list-disc pl-5 space-y-2 text-gray-600">
                    <li>Avoid frequent fast charging</li>
                    <li>Keep battery level between 20-80%</li>
                    <li>Avoid extreme temperatures</li>
                    <li>Follow manufacturer guidelines</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
} 