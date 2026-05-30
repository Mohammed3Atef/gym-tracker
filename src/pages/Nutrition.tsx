import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { FoodItem } from '@/types';
import { useNutrition, computeConsumed } from '@/stores/nutritionStore';
import { useSettings } from '@/stores/settingsStore';
import { useLocalized } from '@/hooks/useLocalized';
import { Icon } from '@/components/Icon';
import { ProgressRing } from '@/components/ProgressRing';
import { Sheet } from '@/components/Sheet';
import { uid } from '@/lib/utils';

export function Nutrition() {
  const { t } = useTranslation();
  const loc = useLocalized();
  const plan = useNutrition((s) => s.plan);
  const log = useNutrition((s) => s.log);
  const toggleMeal = useNutrition((s) => s.toggleMeal);
  const toggleSupplement = useNutrition((s) => s.toggleSupplement);
  const addWater = useNutrition((s) => s.addWater);
  const setCreatine = useNutrition((s) => s.setCreatine);
  const addCustomFood = useNutrition((s) => s.addCustomFood);
  const removeCustomFood = useNutrition((s) => s.removeCustomFood);
  const consumed = useMemo(() => computeConsumed(plan, log), [plan, log]);
  const targets = useSettings((s) => s.settings?.targets);

  const [foodOpen, setFoodOpen] = useState(false);
  const [form, setForm] = useState({ name: '', protein: '', carbs: '', fats: '' });

  if (!plan || !log || !targets) return <p className="text-slate-400">{t('progress.noData')}</p>;

  const macros = [
    { key: 'calories', value: consumed.calories, target: targets.calories, color: '#22c55e' },
    { key: 'protein', value: consumed.protein, target: targets.protein, color: '#38bdf8' },
    { key: 'carbs', value: consumed.carbs, target: targets.carbs, color: '#f59e0b' },
    { key: 'fats', value: consumed.fats, target: targets.fats, color: '#ef4444' },
  ] as const;

  const submitFood = async () => {
    const protein = Number(form.protein) || 0;
    const carbs = Number(form.carbs) || 0;
    const fats = Number(form.fats) || 0;
    const food: FoodItem = {
      id: uid('food'),
      name: { en: form.name || 'Custom food', ar: form.name || 'طعام' },
      quantity: '',
      protein,
      carbs,
      fats,
      calories: Math.round(protein * 4 + carbs * 4 + fats * 9),
    };
    await addCustomFood(food);
    setForm({ name: '', protein: '', carbs: '', fats: '' });
    setFoodOpen(false);
  };

  const waterPct = Math.min(1, log.waterMl / targets.waterMl);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t('nutrition.title')}</h1>

      {/* Macro rings */}
      <div className="card grid grid-cols-4 gap-1">
        {macros.map((m) => (
          <div key={m.key} className="flex flex-col items-center">
            <ProgressRing
              value={m.target ? m.value / m.target : 0}
              size={62}
              stroke={6}
              color={m.color}
              label={String(Math.round(m.value))}
            />
            <span className="mt-1 text-[10px] uppercase text-slate-400">{t(`nutrition.${m.key}`)}</span>
            <span className="text-[10px] text-slate-500">/{m.target}</span>
          </div>
        ))}
      </div>

      {/* Water */}
      <div className="card">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon name="water" size={20} className="text-accent" />
            <span className="font-semibold">{t('nutrition.water')}</span>
          </div>
          <span className="text-sm text-slate-400">{log.waterMl} / {targets.waterMl} ml</span>
        </div>
        <div className="mb-3 h-2 overflow-hidden rounded-full bg-surface-raised">
          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${waterPct * 100}%` }} />
        </div>
        <div className="flex gap-2">
          {[250, 500, 1000].map((ml) => (
            <button key={ml} type="button" onClick={() => void addWater(ml)} className="btn-ghost h-11 flex-1 text-sm">
              +{ml}
            </button>
          ))}
          <button type="button" onClick={() => void addWater(-250)} className="icon-btn h-11 w-11">
            <Icon name="minus" size={16} />
          </button>
        </div>
      </div>

      {/* Meals */}
      <div className="space-y-3">
        {plan.meals.map((meal) => {
          const eaten = !!log.mealsEaten[meal.id];
          const mealMacros = meal.items.reduce(
            (a, i) => ({ p: a.p + i.protein, c: a.c + i.carbs, f: a.f + i.fats, kcal: a.kcal + i.calories }),
            { p: 0, c: 0, f: 0, kcal: 0 },
          );
          return (
            <section key={meal.id} className={`card ${eaten ? 'ring-1 ring-brand/40' : ''}`}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold">{loc(meal.label)}</h2>
                  <p className="text-xs text-slate-400">
                    {mealMacros.kcal} kcal · P{mealMacros.p} C{mealMacros.c} F{mealMacros.f}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void toggleMeal(meal.id)}
                  className={`flex h-11 w-11 items-center justify-center rounded-xl ${eaten ? 'bg-brand text-slate-950' : 'bg-surface-raised text-slate-400'}`}
                  aria-label={t('nutrition.markEaten')}
                >
                  <Icon name="check" size={20} />
                </button>
              </div>
              <ul className="mt-2 space-y-1 text-sm text-slate-300">
                {meal.items.map((item) => (
                  <li key={item.id} className="flex justify-between">
                    <span>{loc(item.name)}</span>
                    <span className="text-slate-500">{item.quantity}</span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      {/* Custom foods */}
      {log.customFoods.length > 0 && (
        <div className="card">
          <h2 className="mb-2 font-bold">{t('nutrition.addFood')}</h2>
          <ul className="space-y-1 text-sm">
            {log.customFoods.map((f) => (
              <li key={f.id} className="flex items-center justify-between">
                <span>{loc(f.name)} · {f.calories} kcal</span>
                <button type="button" onClick={() => void removeCustomFood(f.id)} className="text-danger">
                  <Icon name="close" size={16} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <button type="button" onClick={() => setFoodOpen(true)} className="btn-ghost w-full">
        <Icon name="plus" size={18} /> {t('nutrition.addFood')}
      </button>

      {/* Supplements + creatine */}
      <div className="card">
        <h2 className="mb-2 font-bold">{t('nutrition.supplements')}</h2>
        <ul className="space-y-2">
          {plan.supplements.map((s) => {
            const taken = !!log.supplementsTaken[s.id];
            return (
              <li key={s.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon name="pill" size={18} className="text-slate-400" />
                  <div>
                    <p className="text-sm font-medium">{s.name}</p>
                    <p className="text-xs text-slate-500">{loc(s.dose)}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void toggleSupplement(s.id)}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg ${taken ? 'bg-brand text-slate-950' : 'bg-surface-raised text-slate-400'}`}
                >
                  <Icon name="check" size={16} />
                </button>
              </li>
            );
          })}
          <li className="flex items-center justify-between border-t border-white/5 pt-2">
            <span className="text-sm font-medium">{t('nutrition.creatineTaken')}</span>
            <button
              type="button"
              onClick={() => void setCreatine(!log.creatineTaken)}
              className={`flex h-9 w-9 items-center justify-center rounded-lg ${log.creatineTaken ? 'bg-brand text-slate-950' : 'bg-surface-raised text-slate-400'}`}
            >
              <Icon name="check" size={16} />
            </button>
          </li>
        </ul>
      </div>

      {/* Notes */}
      <div className="card text-sm text-slate-300">
        <h2 className="mb-2 font-bold">{t('nutrition.notes')}</h2>
        <ul className="list-inside list-disc space-y-1">
          {plan.generalNotes.map((n, i) => (
            <li key={i}>{loc(n)}</li>
          ))}
        </ul>
        <h3 className="mb-1 mt-3 font-semibold text-slate-400">{t('nutrition.beverages')}</h3>
        <ul className="list-inside list-disc space-y-1">
          {plan.beverageNotes.map((n, i) => (
            <li key={i}>{loc(n)}</li>
          ))}
        </ul>
      </div>

      <Sheet open={foodOpen} onClose={() => setFoodOpen(false)} title={t('nutrition.addFood')}>
        <div className="space-y-3">
          <input className="input" placeholder={t('settings.name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <div className="grid grid-cols-3 gap-2">
            <input className="input" inputMode="numeric" placeholder={t('nutrition.protein')} value={form.protein} onChange={(e) => setForm({ ...form, protein: e.target.value })} />
            <input className="input" inputMode="numeric" placeholder={t('nutrition.carbs')} value={form.carbs} onChange={(e) => setForm({ ...form, carbs: e.target.value })} />
            <input className="input" inputMode="numeric" placeholder={t('nutrition.fats')} value={form.fats} onChange={(e) => setForm({ ...form, fats: e.target.value })} />
          </div>
          <button type="button" onClick={() => void submitFood()} className="btn-primary w-full">{t('common.add')}</button>
        </div>
      </Sheet>
    </div>
  );
}
