import {extractionSchema,type ExtractedEvent} from "./schema";

const eventJsonSchema={type:"object",additionalProperties:false,required:["company","title","description","startAt","endAt","location","mode","type","careerCategories","registrationUrl","registrationDeadline","confidence"],properties:{company:{type:["string","null"]},title:{type:"string"},description:{type:["string","null"]},startAt:{type:["string","null"]},endAt:{type:["string","null"]},location:{type:["string","null"]},mode:{enum:["IN_PERSON","VIRTUAL","HYBRID","UNKNOWN"]},type:{enum:["INFO_SESSION","TECH_TALK","COFFEE_CHAT","INTERVIEW","CAREER_FAIR","DEADLINE","WORKSHOP","OTHER"]},careerCategories:{type:"array",items:{enum:["SWE","ML / AI","Hardware","Product","Finance","Consulting","Data","Other"]}},registrationUrl:{type:["string","null"]},registrationDeadline:{type:["string","null"]},confidence:{type:"number",minimum:0,maximum:1}}};

export async function extractEvents(content:string,sourceUrl:string):Promise<ExtractedEvent[]>{
  if(!process.env.OPENAI_API_KEY)throw new Error("OPENAI_API_KEY is not configured");
  const response=await fetch("https://api.openai.com/v1/responses",{
    method:"POST",
    headers:{authorization:`Bearer ${process.env.OPENAI_API_KEY}`,"content-type":"application/json"},
    body:JSON.stringify({
      model:process.env.EXTRACTION_MODEL||"gpt-5-mini",
      input:[
        {role:"system",content:"Extract only explicit recruiting events relevant to Cornell students. Never infer missing facts. Use null for unknown fields. Dates must include an explicit UTC offset; if the timezone is absent, leave the date null. Return no events if the page has none."},
        {role:"user",content:`Source URL: ${sourceUrl}\n\nPage content:\n${content}`}
      ],
      text:{format:{type:"json_schema",name:"recruiting_events",strict:true,schema:{type:"object",additionalProperties:false,required:["events"],properties:{events:{type:"array",items:eventJsonSchema}}}}}
    })
  });
  if(!response.ok)throw new Error(`Extraction API returned ${response.status}`);
  const body=await response.json() as {output_text?:string};
  if(!body.output_text)throw new Error("Extraction API returned no structured output");
  return extractionSchema.parse(JSON.parse(body.output_text)).events;
}
