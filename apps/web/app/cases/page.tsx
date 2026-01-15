'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { api } from '@/lib/api';
import { formatCoins } from '@/lib/utils';

interface Case {
  id: string;
  name: string;
  slug: string;
  imageUrl: string;
  price: number;
  isFeatured: boolean;
}

export default function CasesPage() {
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ cases: Case[] }>('/cases')
      .then((res) => {
        if (res.success && res.data) {
          setCases(res.data.cases);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="bg-dark-card rounded-lg p-4 animate-pulse">
              <div className="aspect-square bg-dark-lighter rounded-lg mb-4" />
              <div className="h-4 bg-dark-lighter rounded mb-2" />
              <div className="h-6 bg-dark-lighter rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const featuredCases = cases.filter((c) => c.isFeatured);
  const regularCases = cases.filter((c) => !c.isFeatured);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Featured Cases */}
      {featuredCases.length > 0 && (
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <span className="text-emerald-400">Featured</span> Cases
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {featuredCases.map((caseItem) => (
              <CaseCard key={caseItem.id} caseData={caseItem} featured />
            ))}
          </div>
        </section>
      )}

      {/* All Cases */}
      <section>
        <h2 className="text-2xl font-bold mb-6">All Cases</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {regularCases.map((caseItem) => (
            <CaseCard key={caseItem.id} caseData={caseItem} />
          ))}
        </div>
      </section>
    </div>
  );
}

function CaseCard({ caseData, featured }: { caseData: Case; featured?: boolean }) {
  return (
    <Link href={`/cases/${caseData.slug}`}>
      <div
        className={`
          group bg-dark-card rounded-lg p-4 transition-all duration-300
          hover:bg-dark-lighter hover:scale-105 hover:shadow-lg hover:shadow-emerald-500/20
          ${featured ? 'ring-1 ring-emerald-500/30' : ''}
        `}
      >
        <div className="aspect-square relative mb-4 overflow-hidden rounded-lg">
          {caseData.imageUrl ? (
            <Image
              src={caseData.imageUrl}
              alt={caseData.name}
              fill
              className="object-contain group-hover:scale-110 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-emerald-600/20 to-emerald-400/10 flex items-center justify-center">
              <span className="text-4xl">📦</span>
            </div>
          )}
        </div>
        <h3 className="font-semibold text-sm mb-2 truncate">{caseData.name}</h3>
        <div className="flex items-center gap-1">
          <span className="text-emerald-400 font-bold">{formatCoins(caseData.price)}</span>
          <span className="text-xs text-gray-500">coins</span>
        </div>
      </div>
    </Link>
  );
}
