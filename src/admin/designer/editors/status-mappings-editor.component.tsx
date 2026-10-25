import React, { useState } from 'react';
import { Button, Select, SelectItem, Stack, TextInput } from '@carbon/react';
import { useTranslation } from 'react-i18next';
import type { ModelDefinition, WidgetInstance } from '../../../types/caremodels';
import { tagTones, type StatusMapping } from '../../../widgets/widget-properties';

export function StatusMappingsEditor({
  widget,
  definition,
  onChange,
}: {
  widget: WidgetInstance;
  definition: ModelDefinition;
  onChange: (widget: WidgetInstance) => void;
}) {
  const { t } = useTranslation();
  const [value, setValue] = useState(''),
    [label, setLabel] = useState(''),
    [tone, setTone] = useState<StatusMapping['tone']>('blue');
  const coded = definition.dataSources[widget.dataSource ?? '']?.resultType === 'CODED';
  const mappings = (
    Array.isArray(widget.properties?.statusMappings)
      ? widget.properties.statusMappings.filter(
          (item) => item && typeof item.value === 'string' && typeof item.label === 'string',
        )
      : []
  ) as Array<StatusMapping>;
  const update = (next: Array<StatusMapping>) =>
    onChange({ ...widget, properties: { ...widget.properties, statusMappings: next } });
  return (
    <Stack gap={4}>
      <h5>{t('statusMappings', 'Exact-value status mappings')}</h5>
      <p>
        {t(
          'statusMappingHint',
          'Match an exact returned value to a label and tag color. No clinical state or risk score is calculated here.',
        )}
      </p>
      {coded ? (
        <Select
          id="status-mapping-value"
          labelText={t('codedAnswerBinding', 'Registered coded-answer binding')}
          value={value}
          onChange={(event) => setValue(event.target.value)}>
          <SelectItem value="" text={t('selectAnswerBinding', 'Select a bound answer')} />
          {Object.entries(definition.terminology.codedAnswers ?? {}).map(([alias, uuid]) => (
            <SelectItem key={alias} value={uuid} text={`${alias} — ${uuid}`} />
          ))}
        </Select>
      ) : (
        <TextInput
          id="status-mapping-value"
          labelText={t('exactValue', 'Exact value')}
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      )}
      <TextInput
        id="status-mapping-label"
        labelText={t('statusLabel', 'Status label')}
        value={label}
        maxLength={100}
        onChange={(event) => setLabel(event.target.value)}
      />
      <Select
        id="status-mapping-tone"
        labelText={t('tagColor', 'Tag color')}
        value={tone}
        onChange={(event) => setTone(event.target.value as StatusMapping['tone'])}>
        {tagTones.map((item) => (
          <SelectItem key={item} value={item} text={t(`tagTone.${item}`, item)} />
        ))}
      </Select>
      <Button
        kind="tertiary"
        size="sm"
        disabled={
          !value.trim() || !label.trim() || mappings.length >= 50 || mappings.some((item) => item.value === value)
        }
        onClick={() => {
          update([...mappings, { value, label: label.trim(), tone }]);
          setValue('');
          setLabel('');
        }}>
        {t('addStatusMapping', 'Add status mapping')}
      </Button>
      {mappings.map((item) => (
        <div key={item.value}>
          <p>
            {item.value}: {item.label} ({item.tone})
          </p>
          <Button
            kind="ghost"
            size="sm"
            onClick={() => update(mappings.filter((mapping) => mapping.value !== item.value))}>
            {t('removeStatusMapping', 'Remove mapping {{label}}', { label: item.label })}
          </Button>
        </div>
      ))}
    </Stack>
  );
}
