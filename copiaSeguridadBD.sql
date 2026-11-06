--
-- PostgreSQL database dump
--

\restrict prQm3dgA0hn5eYPoCnQHQs7pNt2yNiOnliXJi1uSeQzxGnAG9LmPcVRdxXxClEu

-- Dumped from database version 16.15
-- Dumped by pg_dump version 16.15

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: emergencies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.emergencies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id text NOT NULL,
    latitude double precision,
    longitude double precision,
    description text,
    severity text,
    status text DEFAULT 'PENDING'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    location_encrypted text,
    location_anonymized_at timestamp with time zone,
    assigned_officer_id text,
    emergency_type text,
    correlation_id uuid,
    incident_id uuid,
    closed_at timestamp with time zone,
    CONSTRAINT emergencies_emergency_type_check CHECK (((emergency_type IS NULL) OR (emergency_type = ANY (ARRAY['MEDICA'::text, 'INCENDIO'::text, 'INFRAESTRUCTURA'::text, 'DISTURBIO_EVENTO_MASIVO'::text, 'OTRO'::text, 'PANICO'::text])))),
    CONSTRAINT emergencies_severity_check CHECK (((severity IS NULL) OR (severity = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text]))))
);


--
-- Name: emergency_access_audit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.emergency_access_audit (
    id bigint NOT NULL,
    emergency_id uuid NOT NULL,
    actor_sub text NOT NULL,
    action text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: emergency_access_audit_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.emergency_access_audit_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: emergency_access_audit_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.emergency_access_audit_id_seq OWNED BY public.emergency_access_audit.id;


--
-- Name: emergency_status_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.emergency_status_history (
    id bigint NOT NULL,
    emergency_id uuid NOT NULL,
    previous_status text,
    new_status text NOT NULL,
    actor text,
    reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: emergency_status_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.emergency_status_history_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: emergency_status_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.emergency_status_history_id_seq OWNED BY public.emergency_status_history.id;


--
-- Name: flyway_schema_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.flyway_schema_history (
    installed_rank integer NOT NULL,
    version character varying(50),
    description character varying(200) NOT NULL,
    type character varying(20) NOT NULL,
    script character varying(1000) NOT NULL,
    checksum integer,
    installed_by character varying(100) NOT NULL,
    installed_on timestamp without time zone DEFAULT now() NOT NULL,
    execution_time integer NOT NULL,
    success boolean NOT NULL
);


--
-- Name: incidents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.incidents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    emergency_type text,
    priority text,
    score numeric,
    reason_codes jsonb,
    algorithm_version text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    factors jsonb,
    CONSTRAINT incidents_emergency_type_check CHECK (((emergency_type IS NULL) OR (emergency_type = ANY (ARRAY['MEDICA'::text, 'INCENDIO'::text, 'INFRAESTRUCTURA'::text, 'DISTURBIO_EVENTO_MASIVO'::text, 'OTRO'::text, 'PANICO'::text]))))
);


--
-- Name: officers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.officers (
    id text NOT NULL,
    name text NOT NULL,
    badge_number text NOT NULL,
    location_label text,
    distance_label text,
    status text DEFAULT 'disponible'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT officers_status_check CHECK ((status = ANY (ARRAY['disponible'::text, 'ocupado'::text])))
);


--
-- Name: outbox_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.outbox_events (
    id uuid NOT NULL,
    topic text NOT NULL,
    payload jsonb NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    available_at timestamp with time zone DEFAULT now() NOT NULL,
    locked_at timestamp with time zone,
    published_at timestamp with time zone,
    last_error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT outbox_events_status_check CHECK ((status = ANY (ARRAY['PENDING'::text, 'PROCESSING'::text, 'PUBLISHED'::text, 'FAILED'::text])))
);


--
-- Name: emergency_access_audit id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emergency_access_audit ALTER COLUMN id SET DEFAULT nextval('public.emergency_access_audit_id_seq'::regclass);


--
-- Name: emergency_status_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emergency_status_history ALTER COLUMN id SET DEFAULT nextval('public.emergency_status_history_id_seq'::regclass);


--
-- Data for Name: emergencies; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.emergencies (id, user_id, latitude, longitude, description, severity, status, created_at, updated_at, location_encrypted, location_anonymized_at, assigned_officer_id, emergency_type, correlation_id, incident_id, closed_at) FROM stdin;
64fe6c51-4d70-4e87-8a5d-51883e94eb73	CIT-jperez	\N	\N	Bot├│n de p├ínico activado	critical	CANCELLED	2026-09-08 20:18:36.01967+00	2026-09-11 22:41:57.221594+00	\N	2026-09-11 22:41:57.221594+00	\N	\N	64fe6c51-4d70-4e87-8a5d-51883e94eb73	\N	\N
ae106114-aa57-4960-a4f0-cf2362d398d7	CIT-jperez	\N	\N	Bot├│n de p├ínico activado	critical	PENDING	2026-09-08 22:26:18.911466+00	2026-09-11 22:41:57.221594+00	\N	2026-09-11 22:41:57.221594+00	\N	\N	ae106114-aa57-4960-a4f0-cf2362d398d7	\N	\N
fddeef9e-0ff9-4190-a7a7-a011eb1100f4	CIT-jperez	\N	\N	Bot├│n de p├ínico activado	critical	PENDING	2026-09-08 22:35:41.240748+00	2026-09-11 22:41:57.221594+00	\N	2026-09-11 22:41:57.221594+00	\N	\N	fddeef9e-0ff9-4190-a7a7-a011eb1100f4	\N	\N
9c3792bd-ee6d-4085-ae84-9e0cf606d507	CIT-jperez	\N	\N	Bot├│n de p├ínico activado	critical	CANCELLED	2026-09-08 22:35:54.407775+00	2026-09-11 22:41:57.221594+00	\N	2026-09-11 22:41:57.221594+00	\N	\N	9c3792bd-ee6d-4085-ae84-9e0cf606d507	\N	\N
50c2c6a8-e618-4d7c-b339-27a4733f687b	CIT-jperez	\N	\N	Bot├│n de p├ínico activado	critical	CANCELLED	2026-09-08 23:19:05.501029+00	2026-09-11 23:53:11.465282+00	\N	2026-09-11 23:53:11.465282+00	\N	\N	50c2c6a8-e618-4d7c-b339-27a4733f687b	\N	\N
85a8d0cf-0ee1-4386-8507-5ce933b5c685	CIT-jperez	\N	\N	Bot├│n de p├ínico activado	critical	PENDING	2026-09-08 23:34:57.326939+00	2026-09-11 23:53:11.465282+00	\N	2026-09-11 23:53:11.465282+00	\N	\N	85a8d0cf-0ee1-4386-8507-5ce933b5c685	\N	\N
7b9f4b18-cf41-4480-8f8a-1a68591d6cc0	CIT-jperez	\N	\N	Bot├│n de p├ínico activado	critical	PENDING	2026-09-08 23:35:50.762348+00	2026-09-11 23:53:11.465282+00	\N	2026-09-11 23:53:11.465282+00	\N	\N	7b9f4b18-cf41-4480-8f8a-1a68591d6cc0	\N	\N
877cc5e1-3261-46c1-8b12-83be292f4ec5	CIT-jperez	\N	\N	Bot├│n de p├ínico activado	critical	PENDING	2026-09-09 04:35:25.645116+00	2026-09-12 05:57:08.209561+00	\N	2026-09-12 05:57:08.209561+00	\N	\N	877cc5e1-3261-46c1-8b12-83be292f4ec5	\N	\N
93c5fffb-fd2e-4a68-9d57-ff55ce97d5a4	CIT-jperez	\N	\N	Bot├│n de p├ínico activado	critical	PENDING	2026-09-09 04:36:16.618563+00	2026-09-12 05:57:08.209561+00	\N	2026-09-12 05:57:08.209561+00	\N	\N	93c5fffb-fd2e-4a68-9d57-ff55ce97d5a4	\N	\N
20806c5b-07ac-4f56-81a2-5a979e1514dc	CIT-jperez	\N	\N	jlkjkljl	high	PENDING	2026-09-09 05:16:50.906192+00	2026-09-12 05:57:08.209561+00	\N	2026-09-12 05:57:08.209561+00	\N	\N	20806c5b-07ac-4f56-81a2-5a979e1514dc	\N	\N
5cb7eb7f-c3cc-4dda-b239-c0d14b6b9f09	CIT-jperez	\N	\N	Bot├│n de p├ínico activado	critical	VALIDATED	2026-09-09 01:32:46.751496+00	2026-09-21 23:38:42.192739+00	\N	2026-09-12 05:57:08.209561+00	\N	\N	5cb7eb7f-c3cc-4dda-b239-c0d14b6b9f09	\N	\N
39511ea4-4969-4b85-b9fc-e14123346290	CIT-JuanPanico	\N	\N	Bot├│n de p├ínico activado	high	PENDING	2026-09-21 23:39:52.598208+00	2026-09-21 23:39:52.598208+00	RUxDAQEx/ThtpOdcL84+VzrHSNOFlRKTh0Ee0+EiqJLfM9grMrco9LwlV/W155BhJiS4K+EMkfxEUtjitvHDkQyFouBicUZqp+dHvDdYYE1bbK2dVUajQSLarhf/YWdJXQ==	\N	\N	\N	39511ea4-4969-4b85-b9fc-e14123346290	\N	\N
2320998c-9a31-46ca-a40e-9e40536337f7	CIT-JuanPanico	\N	\N	Bot├│n de p├ínico activado	medium	PENDING	2026-09-21 23:40:05.260416+00	2026-09-21 23:40:05.260416+00	RUxDAQExzDCphqyCFVCJYsMTCR8IlH0whnTdwimo0nSFaViVJRAXqwRwMbp3mO+6k8neAW3PjZHS/XDeurnPRd8AB2fGLHtZmES01muLK4PXBB9UzNIwn0DmwXQabrIitA==	\N	\N	\N	2320998c-9a31-46ca-a40e-9e40536337f7	\N	\N
742fe30b-e12d-41f2-b735-f985f301f593	CIT-LuciaTranquila	\N	\N	Bot├│n de p├ínico activado	medium	PENDING	2026-09-23 21:58:36.288337+00	2026-09-23 21:58:55.461604+00	RUxDAQExLp/dsLl/d/gbOLPTawyafqK/8KwWQw9f8E1lu1c7ycB99W09tlNLZI26N9i9ypul99jFx/WXCzbvCsKX18J2QKKW51a9a+ECiiHDB8lU2nHy7Y1qtl0YiYezgw==	\N	\N	INFRAESTRUCTURA	742fe30b-e12d-41f2-b735-f985f301f593	0c1de04f-49e6-4209-b675-499a39678ac5	\N
613e7b63-fc52-478a-b4df-303cf5c50a98	CIT-JuanPanico	\N	\N	Bot├│n de p├ínico activado	medium	CANCELLED	2026-09-23 21:57:37.254453+00	2026-09-23 22:17:15.406402+00	RUxDAQExM3TE2YM+L1yY6d/Tla3AIkqGuoM0R3J2dXNpTVMU/CtqJiBjd/3RjiIf88TPe+qLxuB2ex66dfPWWnzSeswAIUYjnwbZDPxXiEdnGoogtWXWtrGnmQNkDb3Inw==	\N	\N	INFRAESTRUCTURA	613e7b63-fc52-478a-b4df-303cf5c50a98	0c1de04f-49e6-4209-b675-499a39678ac5	\N
5ede18cf-f7a7-407b-8605-05c0ba5238c3	CIT-JuanPanico	\N	\N	Bot├│n de p├ínico activado	critical	CANCELLED	2026-09-22 01:52:23.174169+00	2026-09-23 22:17:24.264133+00	RUxDAQExPEmuLXrFB5Zofn3U0Q81T5YNYPMEohaZxZ/WeKIH2FdRYjWCrGph6rSgy75uh5kQcg6nuCwydY2lCckdU0exOiuOBwUR7PF6J2kILv22nYGrqYgMkAOrsYT+1A==	\N	\N	\N	5ede18cf-f7a7-407b-8605-05c0ba5238c3	\N	\N
c757f4d8-899a-41b1-b6c1-0d6308e13e26	CIT-JuanPanico	\N	\N	Disturbio o evento	medium	DISPATCHED	2026-09-23 22:17:29.51119+00	2026-09-23 22:18:12.674967+00	RUxDAQExrpkx3E7zcV5QmSmtTwWSZKrrytHzsHKE7WFIDWhpIfB3mn0jg8T1Q99jYS/QA/RMHUBy2quHgu9laCFC3KCy8Ti/dX7zKUT0tKyt2bky/a9rdLro1unwQe88Ew==	\N	of-001	DISTURBIO_EVENTO_MASIVO	c757f4d8-899a-41b1-b6c1-0d6308e13e26	\N	\N
\.


--
-- Data for Name: emergency_access_audit; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.emergency_access_audit (id, emergency_id, actor_sub, action, created_at) FROM stdin;
1	64fe6c51-4d70-4e87-8a5d-51883e94eb73	CIT-jperez	emergency:read	2026-09-08 20:18:45.973736+00
2	64fe6c51-4d70-4e87-8a5d-51883e94eb73	CIT-jperez	emergency:read	2026-09-08 20:18:46.059879+00
3	ae106114-aa57-4960-a4f0-cf2362d398d7	CIT-jperez	emergency:read	2026-09-08 22:26:19.568819+00
4	ae106114-aa57-4960-a4f0-cf2362d398d7	CIT-jperez	emergency:read	2026-09-08 22:26:19.770474+00
5	fddeef9e-0ff9-4190-a7a7-a011eb1100f4	CIT-jperez	emergency:read	2026-09-08 22:35:41.637812+00
6	fddeef9e-0ff9-4190-a7a7-a011eb1100f4	CIT-jperez	emergency:read	2026-09-08 22:35:41.714999+00
7	9c3792bd-ee6d-4085-ae84-9e0cf606d507	CIT-jperez	emergency:read	2026-09-08 22:35:54.805329+00
8	9c3792bd-ee6d-4085-ae84-9e0cf606d507	CIT-jperez	emergency:read	2026-09-08 22:35:54.877304+00
9	50c2c6a8-e618-4d7c-b339-27a4733f687b	CIT-jperez	emergency:read	2026-09-08 23:19:06.103693+00
10	50c2c6a8-e618-4d7c-b339-27a4733f687b	CIT-jperez	emergency:read	2026-09-08 23:19:06.189718+00
11	85a8d0cf-0ee1-4386-8507-5ce933b5c685	CIT-jperez	emergency:read	2026-09-08 23:34:57.887733+00
12	85a8d0cf-0ee1-4386-8507-5ce933b5c685	CIT-jperez	emergency:read	2026-09-08 23:34:58.06242+00
13	7b9f4b18-cf41-4480-8f8a-1a68591d6cc0	CIT-jperez	emergency:read	2026-09-08 23:35:51.206994+00
14	7b9f4b18-cf41-4480-8f8a-1a68591d6cc0	CIT-jperez	emergency:read	2026-09-08 23:35:51.32391+00
15	5cb7eb7f-c3cc-4dda-b239-c0d14b6b9f09	CIT-jperez	emergency:read	2026-09-09 01:32:47.077654+00
16	5cb7eb7f-c3cc-4dda-b239-c0d14b6b9f09	CIT-jperez	emergency:read	2026-09-09 01:32:47.156251+00
17	877cc5e1-3261-46c1-8b12-83be292f4ec5	CIT-jperez	emergency:read	2026-09-09 04:35:28.402113+00
18	877cc5e1-3261-46c1-8b12-83be292f4ec5	CIT-jperez	emergency:read	2026-09-09 04:35:28.496457+00
19	93c5fffb-fd2e-4a68-9d57-ff55ce97d5a4	CIT-jperez	emergency:read	2026-09-09 04:36:16.979489+00
20	93c5fffb-fd2e-4a68-9d57-ff55ce97d5a4	CIT-jperez	emergency:read	2026-09-09 04:36:17.066873+00
21	93c5fffb-fd2e-4a68-9d57-ff55ce97d5a4	CIT-jperez	emergency:read	2026-09-09 04:45:43.758333+00
22	93c5fffb-fd2e-4a68-9d57-ff55ce97d5a4	CIT-jperez	emergency:read	2026-09-09 04:45:44.275089+00
23	20806c5b-07ac-4f56-81a2-5a979e1514dc	CIT-jperez	emergency:read	2026-09-09 05:16:51.377956+00
24	20806c5b-07ac-4f56-81a2-5a979e1514dc	CIT-jperez	emergency:read	2026-09-09 05:16:51.481526+00
\.


--
-- Data for Name: emergency_status_history; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.emergency_status_history (id, emergency_id, previous_status, new_status, actor, reason, created_at) FROM stdin;
1	64fe6c51-4d70-4e87-8a5d-51883e94eb73	PENDING	CANCELLED	CIT-jperez	Ya no necesito asistencia	2026-09-08 20:18:59.596677+00
2	9c3792bd-ee6d-4085-ae84-9e0cf606d507	PENDING	CANCELLED	CIT-jperez	Ya no necesito asistencia	2026-09-08 22:36:04.375294+00
3	50c2c6a8-e618-4d7c-b339-27a4733f687b	PENDING	CANCELLED	CIT-jperez	Ya no necesito asistencia	2026-09-08 23:19:08.907094+00
4	5cb7eb7f-c3cc-4dda-b239-c0d14b6b9f09	PENDING	VALIDATED	DISP-Demo001	\N	2026-09-21 23:38:42.192739+00
5	613e7b63-fc52-478a-b4df-303cf5c50a98	PENDING	CANCELLED	CIT-JuanPanico	Ya no necesito asistencia	2026-09-23 22:17:15.406402+00
6	5ede18cf-f7a7-407b-8605-05c0ba5238c3	PENDING	CANCELLED	CIT-JuanPanico	Ya no necesito asistencia	2026-09-23 22:17:24.264133+00
7	c757f4d8-899a-41b1-b6c1-0d6308e13e26	PENDING	VALIDATED	DISP-Demo001	\N	2026-09-23 22:18:02.835471+00
8	c757f4d8-899a-41b1-b6c1-0d6308e13e26	VALIDATED	DISPATCHED	DISP-Demo001	Assigned officer of-001	2026-09-23 22:18:12.674967+00
\.


--
-- Data for Name: flyway_schema_history; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.flyway_schema_history (installed_rank, version, description, type, script, checksum, installed_by, installed_on, execution_time, success) FROM stdin;
1	1	create emergencias	SQL	V1__create_emergencias.sql	990928258	postgres	2026-09-08 19:27:52.445783	55	t
2	2	create emergencia estado historial	SQL	V2__create_emergencia_estado_historial.sql	-618752600	postgres	2026-09-08 19:27:52.588865	28	t
3	3	location encryption and audit	SQL	V3__location_encryption_and_audit.sql	1904632320	postgres	2026-09-08 19:27:52.705613	47	t
4	4	add emergency dashboard fields	SQL	V4__add_emergency_dashboard_fields.sql	682201382	postgres	2026-09-08 19:27:52.780616	21	t
5	5	set emergency default status pending	SQL	V5__set_emergency_default_status_pending.sql	1107203320	postgres	2026-09-08 19:27:52.86951	12	t
6	6	create outbox events	SQL	V6__create_outbox_events.sql	359820247	postgres	2026-09-23 21:38:27.592335	145	t
7	7	add severity enum check	SQL	V7__add_severity_enum_check.sql	-1514590958	postgres	2026-09-23 21:38:27.924681	11	t
8	8	complete outbox lifecycle	SQL	V8__complete_outbox_lifecycle.sql	1717560615	postgres	2026-09-23 21:38:28.005873	28	t
9	9	add correlation id	SQL	V9__add_correlation_id.sql	1781291513	postgres	2026-09-23 21:38:28.155905	35	t
10	10	add emergency type check	SQL	V10__add_emergency_type_check.sql	399456547	postgres	2026-09-23 21:38:28.329173	18	t
11	11	create officers	SQL	V11__create_officers.sql	1434073969	postgres	2026-09-23 21:38:28.427048	66	t
12	12	add incidents table	SQL	V12__add_incidents_table.sql	-1446223424	postgres	2026-09-23 21:38:28.577165	54	t
13	13	add emergency closed at	SQL	V13__add_emergency_closed_at.sql	-300784970	postgres	2026-09-23 21:38:28.689323	7	t
14	14	add incident factors	SQL	V14__add_incident_factors.sql	38282468	postgres	2026-09-23 21:38:28.792844	6	t
\.


--
-- Data for Name: incidents; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.incidents (id, emergency_type, priority, score, reason_codes, algorithm_version, created_at, updated_at, factors) FROM stdin;
0c1de04f-49e6-4209-b675-499a39678ac5	INFRAESTRUCTURA	high	58	["UNIQUE_CITIZENS_THRESHOLD", "PROXIMITY_CLUSTER"]	dbscan-v1	2026-09-23 21:58:55.439598+00	2026-09-23 22:11:55.4923+00	{"maxSeverity": "medium", "reportCount": 2, "recencyMinutes": 13.32005, "maxDistanceMeters": 0, "minDistanceMeters": 0, "uniqueCitizenCount": 2}
\.


--
-- Data for Name: officers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.officers (id, name, badge_number, location_label, distance_label, status, created_at, updated_at) FROM stdin;
of-002	Oficial Mariana L├│pez	CP-3108	Plaza de Mayo	800 m	disponible	2026-09-23 21:38:28.491307+00	2026-09-23 21:38:28.491307+00
of-003	Oficial Mart├¡n Rodr├¡guez	CP-5520	Av. Santa Fe y Callao	1.2 km	disponible	2026-09-23 21:38:28.491307+00	2026-09-23 21:38:28.491307+00
of-004	Oficial Luc├¡a Fern├índez	CP-2214	Palermo Soho	1.5 km	disponible	2026-09-23 21:38:28.491307+00	2026-09-23 21:38:28.491307+00
of-005	Oficial Diego ├ülvarez	CP-7783	Recoleta	2.1 km	disponible	2026-09-23 21:38:28.491307+00	2026-09-23 21:38:28.491307+00
of-006	Oficial Sof├¡a Ruiz	CP-1190	San Telmo	900 m	disponible	2026-09-23 21:38:28.491307+00	2026-09-23 21:38:28.491307+00
of-007	Oficial Pablo M├®ndez	CP-6402	Belgrano	2.8 km	ocupado	2026-09-23 21:38:28.491307+00	2026-09-23 21:38:28.491307+00
of-008	Oficial Valentina Castro	CP-3356	Caballito	3.4 km	disponible	2026-09-23 21:38:28.491307+00	2026-09-23 21:38:28.491307+00
of-009	Oficial Andr├®s Quiroga	CP-8811	Almagro	1.8 km	disponible	2026-09-23 21:38:28.491307+00	2026-09-23 21:38:28.491307+00
of-010	Oficial Camila Torres	CP-5044	Microcentro	600 m	ocupado	2026-09-23 21:38:28.491307+00	2026-09-23 21:38:28.491307+00
of-001	Oficial Carlos G├│mez	CP-4021	Av. 9 de Julio y Corrientes	350 m	ocupado	2026-09-23 21:38:28.491307+00	2026-09-23 22:18:12.674967+00
\.


--
-- Data for Name: outbox_events; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.outbox_events (id, topic, payload, status, attempts, available_at, locked_at, published_at, last_error, created_at) FROM stdin;
e6204ceb-c558-428e-a5d9-8b9fcf2576d9	emergencias.boton-panico	{"data": {"id": "613e7b63-fc52-478a-b4df-303cf5c50a98", "status": "PENDING", "userId": "CIT-JuanPanico", "severity": "medium", "createdAt": "2026-09-23T21:57:37.254Z", "updatedAt": "2026-09-23T21:57:37.254Z", "description": "Bot├│n de p├ínico activado", "correlationId": "613e7b63-fc52-478a-b4df-303cf5c50a98", "emergencyType": "INFRAESTRUCTURA", "assignedOfficerId": null}, "type": "EmergenciaCreada", "eventId": "e6204ceb-c558-428e-a5d9-8b9fcf2576d9", "correlationId": "613e7b63-fc52-478a-b4df-303cf5c50a98"}	PUBLISHED	1	2026-09-23 21:57:37.254453+00	\N	2026-09-23 21:57:41.802463+00	\N	2026-09-23 21:57:37.254453+00
5594d255-4051-4804-8627-014c4a35b4b1	emergencias.boton-panico	{"data": {"id": "742fe30b-e12d-41f2-b735-f985f301f593", "status": "PENDING", "userId": "CIT-LuciaTranquila", "severity": "medium", "createdAt": "2026-09-23T21:58:36.288Z", "updatedAt": "2026-09-23T21:58:36.288Z", "description": "Bot├│n de p├ínico activado", "correlationId": "742fe30b-e12d-41f2-b735-f985f301f593", "emergencyType": "INFRAESTRUCTURA", "assignedOfficerId": null}, "type": "EmergenciaCreada", "eventId": "5594d255-4051-4804-8627-014c4a35b4b1", "correlationId": "742fe30b-e12d-41f2-b735-f985f301f593"}	PUBLISHED	1	2026-09-23 21:58:36.288337+00	\N	2026-09-23 21:58:40.973318+00	\N	2026-09-23 21:58:36.288337+00
561ae953-38b9-4d5e-b724-16bb7e43a8da	emergencias.priorizada	{"data": {"id": "742fe30b-e12d-41f2-b735-f985f301f593", "score": 71, "priority": "high", "incidentId": "0c1de04f-49e6-4209-b675-499a39678ac5", "reasonCodes": ["UNIQUE_CITIZENS_THRESHOLD", "PROXIMITY_CLUSTER"], "correlationId": "742fe30b-e12d-41f2-b735-f985f301f593", "algorithmVersion": "dbscan-v1", "incidentPriority": "high", "priorityIndividual": "medium"}, "type": "EmergenciaPriorizada", "eventId": "561ae953-38b9-4d5e-b724-16bb7e43a8da", "correlationId": "742fe30b-e12d-41f2-b735-f985f301f593"}	PUBLISHED	1	2026-09-23 21:58:55.466569+00	\N	2026-09-23 21:58:56.986515+00	\N	2026-09-23 21:58:55.466569+00
2188d4bd-7b2c-41cd-a7e8-8d78d827a424	emergencias.priorizada	{"data": {"id": "613e7b63-fc52-478a-b4df-303cf5c50a98", "score": 71, "priority": "high", "incidentId": "0c1de04f-49e6-4209-b675-499a39678ac5", "reasonCodes": ["UNIQUE_CITIZENS_THRESHOLD", "PROXIMITY_CLUSTER"], "correlationId": "613e7b63-fc52-478a-b4df-303cf5c50a98", "algorithmVersion": "dbscan-v1", "incidentPriority": "high", "priorityIndividual": "medium"}, "type": "EmergenciaPriorizada", "eventId": "2188d4bd-7b2c-41cd-a7e8-8d78d827a424", "correlationId": "613e7b63-fc52-478a-b4df-303cf5c50a98"}	PUBLISHED	1	2026-09-23 21:58:55.466569+00	\N	2026-09-23 21:58:56.998121+00	\N	2026-09-23 21:58:55.466569+00
3852cb12-7c91-4523-be18-4f0500e3bca7	emergencias.estado-actualizado	{"data": {"id": "613e7b63-fc52-478a-b4df-303cf5c50a98", "actor": "CIT-JuanPanico", "reason": "Ya no necesito asistencia", "newStatus": "CANCELLED", "timestamp": "2026-09-23T22:17:15.430Z", "correlationId": "613e7b63-fc52-478a-b4df-303cf5c50a98", "previousStatus": "PENDING"}, "type": "EmergenciaEstadoActualizado", "eventId": "3852cb12-7c91-4523-be18-4f0500e3bca7", "correlationId": "613e7b63-fc52-478a-b4df-303cf5c50a98"}	PUBLISHED	1	2026-09-23 22:17:15.406402+00	\N	2026-09-23 22:17:17.688228+00	\N	2026-09-23 22:17:15.406402+00
071c0080-b2e1-4f87-91c5-115ee51bd134	emergencias.estado-actualizado	{"data": {"id": "5ede18cf-f7a7-407b-8605-05c0ba5238c3", "actor": "CIT-JuanPanico", "reason": "Ya no necesito asistencia", "newStatus": "CANCELLED", "timestamp": "2026-09-23T22:17:24.277Z", "correlationId": "5ede18cf-f7a7-407b-8605-05c0ba5238c3", "previousStatus": "PENDING"}, "type": "EmergenciaEstadoActualizado", "eventId": "071c0080-b2e1-4f87-91c5-115ee51bd134", "correlationId": "5ede18cf-f7a7-407b-8605-05c0ba5238c3"}	PUBLISHED	1	2026-09-23 22:17:24.264133+00	\N	2026-09-23 22:17:27.646739+00	\N	2026-09-23 22:17:24.264133+00
84d07c60-17db-4fd2-9c1a-004a505f1bf4	emergencias.boton-panico	{"data": {"id": "c757f4d8-899a-41b1-b6c1-0d6308e13e26", "status": "PENDING", "userId": "CIT-JuanPanico", "severity": "medium", "createdAt": "2026-09-23T22:17:29.511Z", "updatedAt": "2026-09-23T22:17:29.511Z", "description": "Disturbio o evento", "correlationId": "c757f4d8-899a-41b1-b6c1-0d6308e13e26", "emergencyType": "DISTURBIO_EVENTO_MASIVO", "assignedOfficerId": null}, "type": "EmergenciaCreada", "eventId": "84d07c60-17db-4fd2-9c1a-004a505f1bf4", "correlationId": "c757f4d8-899a-41b1-b6c1-0d6308e13e26"}	PUBLISHED	1	2026-09-23 22:17:29.51119+00	\N	2026-09-23 22:17:32.64433+00	\N	2026-09-23 22:17:29.51119+00
e28f82e4-5ee2-40cc-8f32-c2f045b6a753	emergencias.estado-actualizado	{"data": {"id": "c757f4d8-899a-41b1-b6c1-0d6308e13e26", "actor": "DISP-Demo001", "reason": null, "newStatus": "VALIDATED", "timestamp": "2026-09-23T22:18:02.846Z", "correlationId": "c757f4d8-899a-41b1-b6c1-0d6308e13e26", "previousStatus": "PENDING"}, "type": "EmergenciaEstadoActualizado", "eventId": "e28f82e4-5ee2-40cc-8f32-c2f045b6a753", "correlationId": "c757f4d8-899a-41b1-b6c1-0d6308e13e26"}	PUBLISHED	1	2026-09-23 22:18:02.835471+00	\N	2026-09-23 22:18:07.695896+00	\N	2026-09-23 22:18:02.835471+00
248cb60f-170d-46a5-a20e-14fbb3103f8b	emergencias.estado-actualizado	{"data": {"id": "c757f4d8-899a-41b1-b6c1-0d6308e13e26", "actor": "DISP-Demo001", "reason": "Assigned officer of-001", "newStatus": "DISPATCHED", "timestamp": "2026-09-23T22:18:12.697Z", "correlationId": "c757f4d8-899a-41b1-b6c1-0d6308e13e26", "previousStatus": "VALIDATED"}, "type": "EmergenciaEstadoActualizado", "eventId": "248cb60f-170d-46a5-a20e-14fbb3103f8b", "correlationId": "c757f4d8-899a-41b1-b6c1-0d6308e13e26"}	PUBLISHED	1	2026-09-23 22:18:12.674967+00	\N	2026-09-23 22:18:17.718877+00	\N	2026-09-23 22:18:12.674967+00
\.


--
-- Name: emergency_access_audit_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.emergency_access_audit_id_seq', 24, true);


--
-- Name: emergency_status_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.emergency_status_history_id_seq', 8, true);


--
-- Name: emergencies emergencies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emergencies
    ADD CONSTRAINT emergencies_pkey PRIMARY KEY (id);


--
-- Name: emergency_access_audit emergency_access_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emergency_access_audit
    ADD CONSTRAINT emergency_access_audit_pkey PRIMARY KEY (id);


--
-- Name: emergency_status_history emergency_status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emergency_status_history
    ADD CONSTRAINT emergency_status_history_pkey PRIMARY KEY (id);


--
-- Name: flyway_schema_history flyway_schema_history_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flyway_schema_history
    ADD CONSTRAINT flyway_schema_history_pk PRIMARY KEY (installed_rank);


--
-- Name: incidents incidents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidents
    ADD CONSTRAINT incidents_pkey PRIMARY KEY (id);


--
-- Name: officers officers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.officers
    ADD CONSTRAINT officers_pkey PRIMARY KEY (id);


--
-- Name: outbox_events outbox_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outbox_events
    ADD CONSTRAINT outbox_events_pkey PRIMARY KEY (id);


--
-- Name: flyway_schema_history_s_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX flyway_schema_history_s_idx ON public.flyway_schema_history USING btree (success);


--
-- Name: idx_access_audit_actor_sub; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_access_audit_actor_sub ON public.emergency_access_audit USING btree (actor_sub);


--
-- Name: idx_access_audit_emergency_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_access_audit_emergency_id ON public.emergency_access_audit USING btree (emergency_id);


--
-- Name: idx_emergencies_assigned_officer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_emergencies_assigned_officer_id ON public.emergencies USING btree (assigned_officer_id);


--
-- Name: idx_emergencies_correlation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_emergencies_correlation_id ON public.emergencies USING btree (correlation_id);


--
-- Name: idx_emergencies_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_emergencies_created_at ON public.emergencies USING btree (created_at DESC);


--
-- Name: idx_emergencies_emergency_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_emergencies_emergency_type ON public.emergencies USING btree (emergency_type);


--
-- Name: idx_emergencies_incident_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_emergencies_incident_id ON public.emergencies USING btree (incident_id);


--
-- Name: idx_emergencies_location_retention; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_emergencies_location_retention ON public.emergencies USING btree (created_at) WHERE ((location_encrypted IS NOT NULL) AND (location_anonymized_at IS NULL));


--
-- Name: idx_emergencies_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_emergencies_status ON public.emergencies USING btree (status);


--
-- Name: idx_emergencies_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_emergencies_user_id ON public.emergencies USING btree (user_id);


--
-- Name: idx_history_emergency_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_history_emergency_id ON public.emergency_status_history USING btree (emergency_id);


--
-- Name: idx_officers_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_officers_status ON public.officers USING btree (status);


--
-- Name: idx_outbox_events_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_outbox_events_pending ON public.outbox_events USING btree (available_at, created_at) WHERE (status = ANY (ARRAY['PENDING'::text, 'PROCESSING'::text]));


--
-- Name: idx_outbox_events_published_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_outbox_events_published_created_at ON public.outbox_events USING btree (created_at) WHERE (status = 'PUBLISHED'::text);


--
-- Name: emergencies emergencies_incident_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emergencies
    ADD CONSTRAINT emergencies_incident_id_fkey FOREIGN KEY (incident_id) REFERENCES public.incidents(id) ON DELETE SET NULL;


--
-- Name: emergency_access_audit emergency_access_audit_emergency_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emergency_access_audit
    ADD CONSTRAINT emergency_access_audit_emergency_id_fkey FOREIGN KEY (emergency_id) REFERENCES public.emergencies(id) ON DELETE CASCADE;


--
-- Name: emergency_status_history emergency_status_history_emergency_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emergency_status_history
    ADD CONSTRAINT emergency_status_history_emergency_id_fkey FOREIGN KEY (emergency_id) REFERENCES public.emergencies(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict prQm3dgA0hn5eYPoCnQHQs7pNt2yNiOnliXJi1uSeQzxGnAG9LmPcVRdxXxClEu

