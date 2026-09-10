'use client';

import { useMemo, useState } from 'react';
import { CheckIcon, ChevronsUpDownIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { Template } from '@/lib/types';

/**
 * 폼 생성 대화상자의 템플릿 선택 콤보박스(ADR 0021, 2026-09-10 개정).
 * 트리거는 w-full 고정 폭에 선택된 템플릿 이름을 줄임표로 보여주고, 입력으로 이름을 필터링한다.
 * 값은 템플릿 id로 상위가 관리한다(controlled component).
 */
export function TemplateCombobox({
  templates,
  value,
  onChange,
  id,
}: {
  templates: Template[];
  value: string;
  onChange: (id: string) => void;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => templates.find((t) => t.id === value) ?? null, [templates, value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          />
        }
      >
        <span className="min-w-0 flex-1 truncate text-left">{selected ? selected.name : '템플릿 선택'}</span>
        <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Command>
          <CommandInput placeholder="템플릿 이름 검색" />
          <CommandList>
            <CommandEmpty>템플릿이 없습니다.</CommandEmpty>
            <CommandGroup>
              {templates.map((template) => (
                <CommandItem
                  key={template.id}
                  value={template.name}
                  onSelect={() => {
                    onChange(template.id);
                    setOpen(false);
                  }}
                >
                  <CheckIcon className={cn('size-4', template.id === value ? 'opacity-100' : 'opacity-0')} />
                  <span className="truncate">{template.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
