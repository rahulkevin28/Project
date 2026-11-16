-- Add execution settings to existing workflows without discarding legacy rows.
-- Existing workflows with no associated agents retain a NULL entry_agent and cannot execute.
DO $$
BEGIN
    IF to_regclass('public.workflows') IS NOT NULL THEN
        ALTER TABLE public.workflows
            ADD COLUMN IF NOT EXISTS entry_agent VARCHAR(120);
        ALTER TABLE public.workflows
            ADD COLUMN IF NOT EXISTS max_handoffs INTEGER;

        UPDATE public.workflows
        SET max_handoffs = 8
        WHERE max_handoffs IS NULL;

        IF to_regclass('public.workflow_agents') IS NOT NULL
           AND to_regclass('public.agents') IS NOT NULL THEN
            UPDATE public.workflows AS w
            SET entry_agent = (
                SELECT a.name
                FROM public.workflow_agents AS wa
                JOIN public.agents AS a ON a.id = wa.agent_id
                WHERE wa.workflow_id = w.id
                ORDER BY a.id
                LIMIT 1
            )
            WHERE w.entry_agent IS NULL
              AND EXISTS (
                  SELECT 1
                  FROM public.workflow_agents AS wa
                  JOIN public.agents AS a ON a.id = wa.agent_id
                  WHERE wa.workflow_id = w.id
              );
        END IF;

        ALTER TABLE public.workflows
            ALTER COLUMN max_handoffs SET DEFAULT 8;
        ALTER TABLE public.workflows
            ALTER COLUMN max_handoffs SET NOT NULL;
    END IF;
END $$;
