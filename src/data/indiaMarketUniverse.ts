export type IndiaMarketSector =
  | 'Banking & Financial Services'
  | 'Information Technology'
  | 'Energy & Utilities'
  | 'FMCG & Consumer'
  | 'Automobile'
  | 'Pharmaceuticals & Healthcare'
  | 'Metals, Materials & Industrials'
  | 'Telecom & Digital';

export type IndiaMarketCompany = {
  id: string;
  officialName: string;
  displayName: string;
  providerSymbol: string;
  exchange: 'NSE';
  sector: IndiaMarketSector;
  industry: string;
  officialWebsite: string;
  providerSupport: 'configured';
};

const c = (id: string, officialName: string, displayName: string, providerSymbol: string, sector: IndiaMarketSector, industry: string, officialWebsite: string): IndiaMarketCompany => ({ id, officialName, displayName, providerSymbol, exchange: 'NSE', sector, industry, officialWebsite, providerSupport: 'configured' });

export const INDIA_MARKET_UNIVERSE: IndiaMarketCompany[] = [
  c('hdfc-bank','HDFC Bank Limited','HDFC Bank','HDFCBANK.NS','Banking & Financial Services','Private Bank','https://www.hdfcbank.com'),
  c('icici-bank','ICICI Bank Limited','ICICI Bank','ICICIBANK.NS','Banking & Financial Services','Private Bank','https://www.icicibank.com'),
  c('sbi','State Bank of India','State Bank of India','SBIN.NS','Banking & Financial Services','Public Sector Bank','https://sbi.co.in'),
  c('kotak-bank','Kotak Mahindra Bank Limited','Kotak Mahindra Bank','KOTAKBANK.NS','Banking & Financial Services','Private Bank','https://www.kotak.com'),
  c('axis-bank','Axis Bank Limited','Axis Bank','AXISBANK.NS','Banking & Financial Services','Private Bank','https://www.axisbank.com'),
  c('bajaj-finance','Bajaj Finance Limited','Bajaj Finance','BAJFINANCE.NS','Banking & Financial Services','Non-Banking Financial Company','https://www.bajajfinserv.in'),
  c('bajaj-finserv','Bajaj Finserv Limited','Bajaj Finserv','BAJAJFINSV.NS','Banking & Financial Services','Financial Services','https://www.bajajfinserv.in'),
  c('indusind-bank','IndusInd Bank Limited','IndusInd Bank','INDUSINDBK.NS','Banking & Financial Services','Private Bank','https://www.indusind.com'),
  c('shriram-finance','Shriram Finance Limited','Shriram Finance','SHRIRAMFIN.NS','Banking & Financial Services','Non-Banking Financial Company','https://www.shriramfinance.in'),
  c('hdfc-life','HDFC Life Insurance Company Limited','HDFC Life','HDFCLIFE.NS','Banking & Financial Services','Life Insurance','https://www.hdfclife.com'),
  c('sbi-life','SBI Life Insurance Company Limited','SBI Life','SBILIFE.NS','Banking & Financial Services','Life Insurance','https://www.sbilife.co.in'),
  c('icici-pru','ICICI Prudential Life Insurance Company Limited','ICICI Prudential Life','ICICIPRULI.NS','Banking & Financial Services','Life Insurance','https://www.iciciprulife.com'),

  c('tcs','Tata Consultancy Services Limited','Tata Consultancy Services','TCS.NS','Information Technology','IT Services','https://www.tcs.com'),
  c('infosys','Infosys Limited','Infosys','INFY.NS','Information Technology','IT Services','https://www.infosys.com'),
  c('hcl-tech','HCL Technologies Limited','HCL Technologies','HCLTECH.NS','Information Technology','IT Services','https://www.hcltech.com'),
  c('wipro','Wipro Limited','Wipro','WIPRO.NS','Information Technology','IT Services','https://www.wipro.com'),
  c('tech-mahindra','Tech Mahindra Limited','Tech Mahindra','TECHM.NS','Information Technology','IT Services','https://www.techmahindra.com'),
  c('ltimindtree','LTIMindtree Limited','LTIMindtree','LTIM.NS','Information Technology','IT Services','https://www.ltimindtree.com'),
  c('persistent','Persistent Systems Limited','Persistent Systems','PERSISTENT.NS','Information Technology','Software & IT Services','https://www.persistent.com'),
  c('mphasis','Mphasis Limited','Mphasis','MPHASIS.NS','Information Technology','IT Services','https://www.mphasis.com'),
  c('coforge','Coforge Limited','Coforge','COFORGE.NS','Information Technology','IT Services','https://www.coforge.com'),

  c('reliance','Reliance Industries Limited','Reliance Industries','RELIANCE.NS','Energy & Utilities','Diversified Energy & Consumer','https://www.ril.com'),
  c('ntpc','NTPC Limited','NTPC','NTPC.NS','Energy & Utilities','Power Generation','https://ntpc.co.in'),
  c('power-grid','Power Grid Corporation of India Limited','Power Grid','POWERGRID.NS','Energy & Utilities','Power Transmission','https://www.powergrid.in'),
  c('ongc','Oil and Natural Gas Corporation Limited','ONGC','ONGC.NS','Energy & Utilities','Oil & Gas Exploration','https://ongcindia.com'),
  c('adani-ports','Adani Ports and Special Economic Zone Limited','Adani Ports','ADANIPORTS.NS','Energy & Utilities','Ports & Logistics','https://www.adaniports.com'),
  c('tata-power','Tata Power Company Limited','Tata Power','TATAPOWER.NS','Energy & Utilities','Power Utility','https://www.tatapower.com'),
  c('gail','GAIL (India) Limited','GAIL India','GAIL.NS','Energy & Utilities','Natural Gas','https://gailonline.com'),
  c('ioc','Indian Oil Corporation Limited','Indian Oil','IOC.NS','Energy & Utilities','Oil Refining & Marketing','https://iocl.com'),
  c('bpcl','Bharat Petroleum Corporation Limited','Bharat Petroleum','BPCL.NS','Energy & Utilities','Oil Refining & Marketing','https://www.bharatpetroleum.in'),
  c('coal-india','Coal India Limited','Coal India','COALINDIA.NS','Energy & Utilities','Coal Mining','https://www.coalindia.in'),

  c('itc','ITC Limited','ITC','ITC.NS','FMCG & Consumer','Diversified Consumer','https://www.itcportal.com'),
  c('hul','Hindustan Unilever Limited','Hindustan Unilever','HINDUNILVR.NS','FMCG & Consumer','FMCG','https://www.hul.co.in'),
  c('nestle','Nestlé India Limited','Nestlé India','NESTLEIND.NS','FMCG & Consumer','Packaged Foods','https://www.nestle.in'),
  c('britannia','Britannia Industries Limited','Britannia Industries','BRITANNIA.NS','FMCG & Consumer','Packaged Foods','https://www.britannia.co.in'),
  c('tata-consumer','Tata Consumer Products Limited','Tata Consumer Products','TATACONSUM.NS','FMCG & Consumer','Food & Beverages','https://www.tataconsumer.com'),
  c('dabur','Dabur India Limited','Dabur India','DABUR.NS','FMCG & Consumer','FMCG','https://www.dabur.com'),
  c('godrej-consumer','Godrej Consumer Products Limited','Godrej Consumer Products','GODREJCP.NS','FMCG & Consumer','FMCG','https://www.godrejcp.com'),
  c('marico','Marico Limited','Marico','MARICO.NS','FMCG & Consumer','FMCG','https://marico.com'),
  c('asian-paints','Asian Paints Limited','Asian Paints','ASIANPAINT.NS','FMCG & Consumer','Paints & Coatings','https://www.asianpaints.com'),
  c('titan','Titan Company Limited','Titan Company','TITAN.NS','FMCG & Consumer','Consumer Durables & Jewellery','https://www.titancompany.in'),

  c('maruti','Maruti Suzuki India Limited','Maruti Suzuki','MARUTI.NS','Automobile','Passenger Vehicles','https://www.marutisuzuki.com'),
  c('mahindra','Mahindra & Mahindra Limited','Mahindra & Mahindra','M&M.NS','Automobile','Automobiles & Farm Equipment','https://www.mahindra.com'),
  c('tata-motors','Tata Motors Limited','Tata Motors','TATAMOTORS.NS','Automobile','Automobiles','https://www.tatamotors.com'),
  c('bajaj-auto','Bajaj Auto Limited','Bajaj Auto','BAJAJ-AUTO.NS','Automobile','Two-Wheelers & Three-Wheelers','https://www.bajajauto.com'),
  c('eicher','Eicher Motors Limited','Eicher Motors','EICHERMOT.NS','Automobile','Automobiles','https://www.eichermotors.com'),
  c('hero','Hero MotoCorp Limited','Hero MotoCorp','HEROMOTOCO.NS','Automobile','Two-Wheelers','https://www.heromotocorp.com'),
  c('tvs','TVS Motor Company Limited','TVS Motor','TVSMOTOR.NS','Automobile','Two-Wheelers','https://www.tvsmotor.com'),

  c('sun-pharma','Sun Pharmaceutical Industries Limited','Sun Pharma','SUNPHARMA.NS','Pharmaceuticals & Healthcare','Pharmaceuticals','https://sunpharma.com'),
  c('dr-reddy','Dr. Reddy’s Laboratories Limited','Dr. Reddy’s Laboratories','DRREDDY.NS','Pharmaceuticals & Healthcare','Pharmaceuticals','https://www.drreddys.com'),
  c('cipla','Cipla Limited','Cipla','CIPLA.NS','Pharmaceuticals & Healthcare','Pharmaceuticals','https://www.cipla.com'),
  c('divis','Divi’s Laboratories Limited','Divi’s Laboratories','DIVISLAB.NS','Pharmaceuticals & Healthcare','Pharmaceuticals','https://www.divislabs.com'),
  c('apollo','Apollo Hospitals Enterprise Limited','Apollo Hospitals','APOLLOHOSP.NS','Pharmaceuticals & Healthcare','Hospitals','https://www.apollohospitals.com'),
  c('lupin','Lupin Limited','Lupin','LUPIN.NS','Pharmaceuticals & Healthcare','Pharmaceuticals','https://www.lupin.com'),
  c('aurobindo','Aurobindo Pharma Limited','Aurobindo Pharma','AUROPHARMA.NS','Pharmaceuticals & Healthcare','Pharmaceuticals','https://www.aurobindo.com'),

  c('larsen','Larsen & Toubro Limited','Larsen & Toubro','LT.NS','Metals, Materials & Industrials','Engineering & Construction','https://www.larsentoubro.com'),
  c('ultratech','UltraTech Cement Limited','UltraTech Cement','ULTRACEMCO.NS','Metals, Materials & Industrials','Cement','https://www.ultratechcement.com'),
  c('tata-steel','Tata Steel Limited','Tata Steel','TATASTEEL.NS','Metals, Materials & Industrials','Steel','https://www.tatasteel.com'),
  c('jsw-steel','JSW Steel Limited','JSW Steel','JSWSTEEL.NS','Metals, Materials & Industrials','Steel','https://www.jswsteel.in'),
  c('hindalco','Hindalco Industries Limited','Hindalco Industries','HINDALCO.NS','Metals, Materials & Industrials','Metals','https://www.hindalco.com'),
  c('grasim','Grasim Industries Limited','Grasim Industries','GRASIM.NS','Metals, Materials & Industrials','Diversified Materials','https://www.grasim.com'),
  c('adani-enterprises','Adani Enterprises Limited','Adani Enterprises','ADANIENT.NS','Metals, Materials & Industrials','Diversified Industrials','https://www.adanienterprises.com'),

  c('airtel','Bharti Airtel Limited','Bharti Airtel','BHARTIARTL.NS','Telecom & Digital','Telecommunications','https://www.airtel.in'),
  c('jio-financial','Jio Financial Services Limited','Jio Financial Services','JIOFIN.NS','Telecom & Digital','Financial Technology','https://www.jfs.in'),
  c('info-edge','Info Edge (India) Limited','Info Edge','NAUKRI.NS','Telecom & Digital','Internet Services','https://www.infoedge.in'),
];

export const INDIA_MARKET_SECTORS: IndiaMarketSector[] = Array.from(new Set(INDIA_MARKET_UNIVERSE.map((item) => item.sector)));
